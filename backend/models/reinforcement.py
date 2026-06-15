from __future__ import annotations
import math
import random
import time
from typing import Any
from .persistence import save_q_table, save_experience_buffer, load_latest_q_table, load_all_experiences
from .quality_scorer import PARAM_DEFS, DEFAULT_PARAMS

LEARNING_RATE = 0.1
DISCOUNT_FACTOR = 0.9
EPSILON = 0.2
AUTO_TRAIN_THRESHOLD = 50
PERSIST_INTERVAL = 10
MAX_BUFFER_SIZE = 2000
MIN_TRAIN_BATCH = 32

# Build everything from PARAM_DEFS
ALL_PARAMS_KEYS: list[str] = [name for name, *_ in PARAM_DEFS]
# Categorize by name prefix for range clamping
WEIGHT_KEYS = [name for name, *_ in PARAM_DEFS if name.startswith('w_')]
BONUS_KEYS = [name for name, *_ in PARAM_DEFS if name.startswith('b_')]
BASE_KEYS = [name for name, *_ in PARAM_DEFS if name.startswith('base_')]
SUBSCORE_KEYS = [name for name, *_ in PARAM_DEFS if name.startswith(('cq_', 'doc_', 'maint_', 'comm_', 'sec_'))]

# Build param metadata dict for quick lookup
PARAM_META: dict[str, dict] = {name: {'range': (lo, hi), 'deltas': deltas}
                               for name, _, lo, hi, deltas in PARAM_DEFS}

# Build all possible actions from param definitions
POSSIBLE_ACTIONS: list[dict] = []
for name, _, _, _, deltas in PARAM_DEFS:
    for d in deltas:
        POSSIBLE_ACTIONS.append({'paramName': name, 'delta': d})


def compute_readme_metrics(readme: str) -> dict:
    if not readme:
        return {k: 0 for k in ['headingCount', 'codeBlockCount', 'imageCount', 'badgeCount',
                                'emojiCount', 'tableCount', 'checklistCount', 'linkCount',
                                'todoCount', 'fixmeCount', 'hackCount', 'tempCount']}
    import re
    heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))
    code_block_count = (len(re.findall(r'```', readme)) or 0) / 2
    image_count = len(re.findall(r'!\[.*?\]\(.*?\)', readme)) + len(re.findall(r'<img\s', readme, re.IGNORECASE))
    badge_count = len(re.findall(r'https?://img\.shields\.io/', readme)) + len(re.findall(r'https?://badge\.', readme))
    emoji = re.findall(r'[\U0001F300-\U0001F9FF\U00002600-\U000027BF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U0000FE00-\U0000FE0F]', readme)
    emoji_count = len(emoji)
    table_rows = re.findall(r'^\|.+\|[\s]*$', readme, re.MULTILINE)
    table_count = max(1, len(table_rows) // 5) if len(table_rows) > 1 else 0
    checklist_count = len(re.findall(r'-\s\[[ x]\]', readme, re.IGNORECASE))
    link_count = len(re.findall(r'\[.*?\]\(.*?\)', readme))
    lower = readme.lower()
    todo_count = len(re.findall(r'todo|@todo', lower))
    fixme_count = len(re.findall(r'fixme|@fix', lower))
    hack_count = len(re.findall(r'hack|@hack', lower))
    temp_count = len(re.findall(r'temp(orary)?|@temp', lower))
    return {
        'headingCount': heading_count, 'codeBlockCount': code_block_count,
        'imageCount': image_count, 'badgeCount': badge_count, 'emojiCount': emoji_count,
        'tableCount': table_count, 'checklistCount': checklist_count, 'linkCount': link_count,
        'todoCount': todo_count, 'fixmeCount': fixme_count, 'hackCount': hack_count, 'tempCount': temp_count,
    }


def quantize_state(state: dict) -> str:
    bins = {
        'repoStars': 0 if state['repoStars'] < 10 else (1 if state['repoStars'] < 100 else (2 if state['repoStars'] < 1000 else 3)),
        'repoForks': 0 if state['repoForks'] < 5 else (1 if state['repoForks'] < 50 else (2 if state['repoForks'] < 500 else 3)),
        'fileCount': 0 if state['fileCount'] < 20 else (1 if state['fileCount'] < 100 else (2 if state['fileCount'] < 500 else 3)),
        'languageCount': 0 if state['languageCount'] <= 2 else (1 if state['languageCount'] <= 4 else 2),
        'readmeLength': 0 if state['readmeLength'] < 100 else (1 if state['readmeLength'] < 500 else (2 if state['readmeLength'] < 2000 else 3)),
        'contributorCount': 0 if state['contributorCount'] <= 1 else (1 if state['contributorCount'] <= 5 else (2 if state['contributorCount'] <= 20 else 3)),
        'hasTests': 1 if state['hasTests'] else 0,
        'hasCI': 1 if state['hasCI'] else 0,
        'readmeScore': 0 if state['readmeScore'] < 20 else (1 if state['readmeScore'] < 40 else (2 if state['readmeScore'] < 60 else (3 if state['readmeScore'] < 80 else 4))),
        'docsSectionCount': 0 if state['docsSectionCount'] == 0 else (1 if state['docsSectionCount'] <= 3 else (2 if state['docsSectionCount'] <= 6 else 3)),
        'hasApiDocs': 1 if state['hasApiDocs'] else 0,
        'hasLicense': 1 if state['hasLicense'] else 0,
        'lastCommitDays': 0 if state['lastCommitDays'] < 30 else (1 if state['lastCommitDays'] < 90 else (2 if state['lastCommitDays'] < 365 else 3)),
        'hasDockerfile': 1 if state.get('hasDockerfile', False) else 0,
        'hasContributing': 1 if state.get('hasContributing', False) else 0,
        'headingCount': 0 if state['headingCount'] == 0 else (1 if state['headingCount'] <= 3 else (2 if state['headingCount'] <= 10 else 3)),
        'codeBlockCount': 0 if state['codeBlockCount'] == 0 else (1 if state['codeBlockCount'] <= 3 else (2 if state['codeBlockCount'] <= 10 else 3)),
        'imageCount': 0 if state['imageCount'] == 0 else (1 if state['imageCount'] <= 3 else 2),
        'badgeCount': 0 if state['badgeCount'] == 0 else (1 if state['badgeCount'] <= 3 else 2),
        'emojiCount': 0 if state['emojiCount'] == 0 else (1 if state['emojiCount'] <= 5 else 2),
        'tableCount': 0 if state['tableCount'] == 0 else (1 if state['tableCount'] <= 3 else 2),
        'checklistCount': 0 if state['checklistCount'] == 0 else (1 if state['checklistCount'] <= 3 else 2),
        'linkCount': 0 if state['linkCount'] == 0 else (1 if state['linkCount'] <= 5 else (2 if state['linkCount'] <= 20 else 3)),
        'todoCount': 0 if state['todoCount'] == 0 else (1 if state['todoCount'] <= 5 else 2),
        'fixmeCount': 0 if state['fixmeCount'] == 0 else (1 if state['fixmeCount'] <= 3 else 2),
        'hackCount': 0 if state['hackCount'] == 0 else 1,
        'tempCount': 0 if state['tempCount'] == 0 else 1,
    }
    return ':'.join(str(v) for v in bins.values())


def _action_key(action: dict) -> str:
    d = action['delta']
    return f"{action['paramName']}:{'+' if d > 0 else ''}{d}"


def _clamp_param(name: str, value: float) -> float:
    """Clamp a parameter value to its defined range."""
    meta = PARAM_META.get(name)
    if meta:
        lo, hi = meta['range']
        return max(lo, min(hi, value))
    return value


def apply_rule_bonuses(params: dict, state: dict, bonuses: dict | None = None) -> dict:
    b = {
        'b_complexity': (bonuses or {}).get('b_complexity', params.get('b_complexity', 10)),
        'b_readme': (bonuses or {}).get('b_readme', params.get('b_readme', 10)),
        'b_activity': (bonuses or {}).get('b_activity', params.get('b_activity', 5)),
    }
    if state.get('hasCI'):
        b['b_complexity'] += 3
    if state.get('hasTests'):
        b['b_complexity'] += 2
    if state.get('fileCount', 0) > 500:
        b['b_complexity'] -= 3
    if state.get('readmeScore', 0) > 70:
        b['b_readme'] += 5
    if state.get('docsSectionCount', 0) >= 6:
        b['b_readme'] += 5
    if state.get('hasApiDocs'):
        b['b_readme'] += 3
    lcd = state.get('lastCommitDays', 999)
    if lcd < 30:
        b['b_activity'] += 5
    elif lcd < 90:
        b['b_activity'] += 3
    if state.get('contributorCount', 0) > 10:
        b['b_activity'] += 3
    result = dict(params)
    result['b_complexity'] = _clamp_param('b_complexity', b['b_complexity'])
    result['b_readme'] = _clamp_param('b_readme', b['b_readme'])
    result['b_activity'] = _clamp_param('b_activity', b['b_activity'])
    return result


class ReinforcementLearner:
    def __init__(self, load_persisted: bool = True) -> None:
        self.q_table: dict[str, dict[str, float]] = {}
        self.experience_buffer: list[dict] = []
        self.max_buffer_size = MAX_BUFFER_SIZE
        self.min_buffer_size = MIN_TRAIN_BATCH
        self.training_steps = 0
        self.current_params: dict[str, float] = dict(DEFAULT_PARAMS)
        self.persist_counter = 0
        self.total_rewards: list[float] = []
        self.episode_rewards: list[float] = []
        self.last_persist_time = time.time()
        if load_persisted:
            self._load_from_disk()

    def get_state_key(self, state: dict) -> str:
        return quantize_state(state)

    def get_q_value(self, state_key: str, action_key: str) -> float:
        return self.q_table.get(state_key, {}).get(action_key, 0.0)

    def set_q_value(self, state_key: str, action_key: str, value: float) -> None:
        if state_key not in self.q_table:
            self.q_table[state_key] = {}
        self.q_table[state_key][action_key] = value

    def select_action(self, state: dict, epsilon: float = EPSILON) -> dict:
        state_key = self.get_state_key(state)
        if random.random() < epsilon:
            return random.choice(POSSIBLE_ACTIONS)
        best_action = POSSIBLE_ACTIONS[0]
        best_value = -float('inf')
        for action in POSSIBLE_ACTIONS:
            akey = _action_key(action)
            value = self.get_q_value(state_key, akey)
            if value > best_value:
                best_value = value
                best_action = action
        return best_action

    def apply_action(self, params: dict, action: dict) -> dict:
        new_params = dict(params)
        current = new_params.get(action['paramName'], 0)
        new_params[action['paramName']] = _clamp_param(action['paramName'], current + action['delta'])
        return new_params

    def store_experience(self, state: dict, action: dict, reward: float, next_state: dict) -> None:
        self.experience_buffer.append({
            'state': state, 'action': action, 'reward': reward,
            'nextState': next_state, 'timestamp': time.time() * 1000,
        })
        self.total_rewards.append(reward)
        self.episode_rewards.append(reward)
        if len(self.experience_buffer) > self.max_buffer_size:
            self.experience_buffer = self.experience_buffer[-self.max_buffer_size:]
        if len(self.total_rewards) > 1000:
            self.total_rewards = self.total_rewards[-1000:]
        self._auto_train()
        self._auto_persist()

    def compute_reward(self, validation_score: float, error_rate: float = 0.0) -> float:
        base = validation_score / 100.0
        penalty = error_rate * 0.5
        return max(-1.0, min(1.0, base - penalty))

    def compute_user_reward(self, rating: float) -> float:
        return max(-1.0, min(1.0, (rating - 3) / 2.0))

    def ingest_user_feedback(self, rating: float, state: dict, action: dict, next_state: dict | None = None) -> None:
        reward = self.compute_user_reward(rating)
        self.store_experience(state, action, reward, next_state or state)

    def train(self, batch_size: int = 64) -> dict:
        if len(self.experience_buffer) < self.min_buffer_size:
            return {'loss': 0.0, 'episodes': 0}
        bs = min(batch_size, len(self.experience_buffer))
        batch = random.sample(self.experience_buffer, bs)
        total_loss = 0.0
        for exp in batch:
            state_key = self.get_state_key(exp['state'])
            akey = _action_key(exp['action'])
            next_state_key = self.get_state_key(exp['nextState'])
            max_next = max((self.get_q_value(next_state_key, _action_key(a)) for a in POSSIBLE_ACTIONS), default=0.0)
            current_q = self.get_q_value(state_key, akey)
            td_target = exp['reward'] + DISCOUNT_FACTOR * max_next
            new_q = current_q + LEARNING_RATE * (td_target - current_q)
            self.set_q_value(state_key, akey, new_q)
            total_loss += (td_target - current_q) ** 2
        self.training_steps += 1
        return {'loss': total_loss / bs, 'episodes': len(batch)}

    def train_multiple(self, epochs: int = 3, batch_size: int = 32) -> dict:
        total_loss = 0.0
        total_episodes = 0
        for _ in range(epochs):
            result = self.train(batch_size)
            total_loss += result['loss']
            total_episodes += result['episodes']
        return {'loss': total_loss / epochs if epochs > 0 else 0, 'episodes': total_episodes}

    def get_optimal_params(self, state: dict) -> dict:
        state_key = self.get_state_key(state)
        best_action = POSSIBLE_ACTIONS[0]
        best_value = -float('inf')
        for action in POSSIBLE_ACTIONS:
            value = self.get_q_value(state_key, _action_key(action))
            if value > best_value:
                best_value = value
                best_action = action
        return self.apply_action(dict(self.current_params), best_action)

    def merge_with_defaults(self, weight_params: dict, state: dict, bonuses: dict | None = None) -> dict:
        return apply_rule_bonuses(weight_params, state, bonuses)

    def get_current_params(self) -> dict:
        return dict(self.current_params)

    def set_current_params(self, params: dict) -> None:
        out = {}
        for k in ALL_PARAMS_KEYS:
            out[k] = _clamp_param(k, params.get(k, self.current_params.get(k, DEFAULT_PARAMS.get(k, 0))))
        self.current_params = out

    def persist(self, label: str = 'latest') -> None:
        flat_q: dict[str, dict[str, float]] = {}
        for sk, actions in self.q_table.items():
            flat_q[sk] = dict(actions)
        save_q_table(flat_q, self.training_steps, label)
        save_experience_buffer(self.experience_buffer[-100:])

    def get_stats(self) -> dict:
        state_count = len(self.q_table)
        action_count = sum(len(actions) for actions in self.q_table.values())
        q_values = [v for actions in self.q_table.values() for v in actions.values()]
        return {
            'states': state_count,
            'totalQValues': action_count,
            'minQ': min(q_values) if q_values else 0,
            'maxQ': max(q_values) if q_values else 0,
            'avgQ': sum(q_values) / len(q_values) if q_values else 0,
            'experiences': len(self.experience_buffer),
            'trainingSteps': self.training_steps,
        }

    def _load_from_disk(self) -> None:
        data = load_latest_q_table()
        if data and data.get('qTable'):
            self.q_table = data['qTable']
            self.training_steps = data.get('trainingSteps', 0)

    def _auto_train(self) -> None:
        if len(self.experience_buffer) >= AUTO_TRAIN_THRESHOLD:
            self.train(max(32, min(128, len(self.experience_buffer) // 4)))

    def _auto_persist(self) -> None:
        self.persist_counter += 1
        if self.persist_counter >= PERSIST_INTERVAL:
            self.persist_counter = 0
            self.persist()


reinforcement_learner = ReinforcementLearner()
