from abc import ABC, abstractmethod
from typing import Dict, Any

class WorkflowExtension(ABC):
    @abstractmethod
    def evaluate_transition(self, context: Dict[str, Any]) -> bool:
        """Evaluates if workflow transition is valid."""
        pass

class NotificationExtension(ABC):
    @abstractmethod
    def route_notification(self, recipient: str, title: str, message: str, channel: str) -> bool:
        """Sends notification to target channel (Slack, Teams, SMS, etc.)."""
        pass

class SearchExtension(ABC):
    @abstractmethod
    def execute_search(self, query: str, limit: int = 10) -> list:
        """Executes search inside module domain."""
        pass

class AIExtension(ABC):
    @abstractmethod
    def generate_recommendation(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generates AI insights or recommendations."""
        pass
