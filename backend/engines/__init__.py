from __future__ import annotations
from typing import Any


class Engine:
    name: str = ''
    description: str = ''
    version: str = '1.0.0'

    def analyze(self, repo: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def score(self, repo: dict[str, Any]) -> dict[str, Any]:
        result = self.analyze(repo)
        return {
            'engine': self.name,
            'score': result.get('score', 0),
            'maxScore': result.get('maxScore', 100),
            'findings': result.get('findings', []),
            'details': result.get('details', {}),
        }


_registry: dict[str, Engine] = {}


def register(engine: Engine) -> None:
    _registry[engine.name] = engine


def get_engine(name: str) -> Engine | None:
    return _registry.get(name)


def list_engines() -> list[str]:
    return list(_registry.keys())


def run_all(repo: dict[str, Any]) -> dict[str, Any]:
    results = {}
    for name, engine in _registry.items():
        try:
            results[name] = engine.score(repo)
        except Exception as e:
            results[name] = {
                'engine': name,
                'score': 0,
                'maxScore': 100,
                'findings': [{'type': 'error', 'message': str(e)}],
                'details': {},
            }
    return results


from . import architecture  # noqa: F401, E402
from . import security  # noqa: F401, E402
from . import git_intelligence  # noqa: F401, E402
from . import dependency  # noqa: F401, E402
