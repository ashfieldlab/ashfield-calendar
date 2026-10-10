"""cron 잡 등록표: 이름, 함수, 스케줄의 단일 소스.

worker.py 가 이 JOBS 로 arq cron_jobs 를 만들고(recorded() 로 감쌈), admin 조회
엔드포인트가 "돌아야 할 잡" 목록으로 읽는다(원장에 실행 기록이 없어도 표시 →
dev 처럼 워커가 안 떠서 조용히 안 도는 상황도 보임). 잡 추가 = 여기 한 줄.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app.core.logging import logger
from app.jobs.booking_pii import purge_expired_booking_pii
from app.jobs.dispatch_relay import dispatch_pending
from app.jobs.external_ics_refresh import refresh_all_external_ics
from app.jobs.job_runs import purge_expired_job_runs
from app.jobs.reminders import dispatch_due_reminders

JobFn = Callable[[dict], Awaitable[int | None]]


@dataclass(frozen=True)
class JobSpec:
    name: str
    fn: JobFn
    # arq cron() 에 그대로 넘길 스케줄 kwargs
    cron_kwargs: dict = field(default_factory=dict)
    # 사람용 스케줄 설명 (모니터링 표시)
    schedule: str = ""


async def heartbeat(ctx: dict) -> int:
    """매시 정각 1회: worker liveness. JobRun 원장에 한 줄 남아 grep 졸업."""
    logger.info("arq_worker_heartbeat", extra={"category": "biz"})
    return 0


JOBS: list[JobSpec] = [
    JobSpec("heartbeat", heartbeat, {"hour": None, "minute": 0, "run_at_startup": True}, "매시 정각"),
    JobSpec("reminders", dispatch_due_reminders, {"minute": None, "run_at_startup": True}, "매 분"),
    JobSpec("dispatch_relay", dispatch_pending, {"minute": None}, "매 분"),
    JobSpec("booking_pii_purge", purge_expired_booking_pii, {"hour": {4}, "minute": {5}}, "매일 04:05"),
    JobSpec("external_ics_refresh", refresh_all_external_ics, {"minute": set(range(0, 60, 5))}, "매 5분"),
    JobSpec("job_run_purge", purge_expired_job_runs, {"hour": {4}, "minute": {10}}, "매일 04:10"),
]
