from abc import ABC, abstractmethod
from typing import Any


class JobSource(ABC):

    @abstractmethod
    def search_jobs(
        self,
        keywords: str,
        location: str = "",
        page: int = 1,
        results_per_page: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Search jobs from an external source and return
        normalized job dictionaries.
        """
        raise NotImplementedError