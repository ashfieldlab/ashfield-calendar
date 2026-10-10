<div align="center">

<img src="frontend/public/icons/ashfield/mark.svg" width="72" alt="Ashfield" />

# Ashfield Calendar

일정과 회의실, 예약을 한곳에서

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![CalDAV](https://img.shields.io/badge/CalDAV-Sabre%2FDAV-777BB4?style=flat-square&logo=php&logoColor=white)](https://sabre.io/dav/)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

</div>

팀의 일정을 함께 보고, 회의실을 잡고, 외부 손님의 예약까지 받습니다.

- **일정**: 반복 일정, 드래그로 옮기기, 멤버와 외부 손님 초대
- **회의실**: 겹치지 않게 예약
- **예약 페이지**: 외부 손님이 빈 시간을 골라 직접 예약
- **어디서나 동기화**: CalDAV 와 ICS 로 휴대폰, 데스크톱 캘린더와 연결

## 시작하기

Node 24+, Python 3.14, Docker 가 필요합니다. [Ashfield Account](https://github.com/ashfieldlab/ashfield-account) 를 먼저 띄워 주세요.

```bash
make setup   # 의존성 설치, 인프라 기동, DB 준비
make dev     # http://localhost:3100
```

## 문서

- [로컬 개발](docs/local-dev.md): 환경 변수, 포트, 테스트
- [도메인 용어](CONTEXT.md)
- [설계 결정](docs/adr/)

## Ashfield

| | |
|---|---|
| [Account](https://github.com/ashfieldlab/ashfield-account) | 계정, 워크스페이스 |
| [Calendar](https://github.com/ashfieldlab/ashfield-calendar) | 일정, 회의실, 예약 |
| [Drive](https://github.com/ashfieldlab/ashfield-drive) | 파일 저장, 공유 |
| [Sync](https://github.com/ashfieldlab/ashfield-sync) | Drive 데스크톱 동기화 (Windows) |

## 라이선스

MIT
