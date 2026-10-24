# 부팅하면 저절로 원격제어 가능 상태 만들기 (자동 로그인 + 자동 실행 + Tailscale)

목표: 스마트 플러그로 전원이 들어오면 `부팅 → 자동 로그인 → 서버·에이전트 자동 실행`까지
사람 없이 진행되고, 폰에서 접속할 수 있는 상태.

> 이 문서는 노트북 앞에서 **한 번만** 합니다. 점검 상태: 스크립트와 설정은 Windows에서 아직 실행해 보지 않았습니다.

## 0. 준비물 (노트북에 설치)
- Node.js 18 이상, Python 3.10 이상, Tailscale
- 이 저장소를 받은 폴더 (예: `C:\vitual-desktop`)

## 1. 프로그램 준비 (처음 1회)
1. PowerShell을 엽니다. `cd C:\vitual-desktop\web-client` → `npm install` → `npm run build`
2. `cd ..\server` → `npm install` → `copy .env.example .env`
3. 메모장으로 `.env`를 열어 `JWT_SECRET`(긴 무작위 문자열)과 `OWNER_PASSWORD`(접속 비밀번호)를 바꾸고 저장합니다.
4. `cd ..\host-agent` → `python -m venv venv` → `venv\Scripts\activate` → `pip install -r requirements.txt`
5. 서버를 한 번 켭니다: 새 PowerShell에서 `cd C:\vitual-desktop\server` → `npm start`
6. 에이전트를 한 번 직접 실행해 페어링합니다: `python agent.py --http http://localhost:8080 --ws ws://localhost:8080`
   화면에 나온 6자리 코드를 웹(`http://localhost:8080`)에 로그인해서 "새 PC 등록"에 입력합니다.
   이후부터는 `device_config.json`에 저장되어 코드가 필요 없습니다.
7. 두 창을 닫습니다.

## 2. 부팅 시 자동 실행 등록
1. 시작 메뉴에서 "PowerShell"을 검색하고 **우클릭 → 관리자 권한으로 실행**
2. 아래를 차례로 입력합니다.
   ```powershell
   cd C:\vitual-desktop\deploy\windows
   Set-ExecutionPolicy -Scope Process Bypass
   .\register-tasks.ps1
   ```
3. "등록됨: DeskControl-Server / DeskControl-Agent"가 나오면 성공입니다.
4. 해제하려면 `.\register-tasks.ps1 -Remove`

## 3. 자동 로그인 설정
Microsoft 계정을 쓰는 노트북은 먼저 이 설정을 풀어야 합니다.
1. 설정 → 계정 → 로그인 옵션 → "보안 강화를 위해 이 장치에서 Microsoft 계정에 대해 Windows Hello 로그인만 허용" 을 **끔**
2. Microsoft 공식 도구 Sysinternals **Autologon**을 내려받아 실행합니다.
   (비밀번호를 평문으로 두지 않고 Windows 보안 저장소에 암호화해 저장합니다.)
3. 사용자 이름, 도메인(보통 PC 이름), 비밀번호를 확인하고 **Enable**을 누릅니다.
4. 재시작해서 비밀번호 입력 없이 바탕화면까지 가는지 확인합니다.

주의
- 전원이 들어오면 누구나 바탕화면까지 들어갑니다. 집 안에 둔 노트북에서만 쓰세요.
- BitLocker를 켜 두었다면 TPM만 쓰는 설정이어야 부팅 중에 복구키를 묻지 않습니다.
- 잠금 화면이 다시 뜨지 않게 하려면 설정 → 계정 → 로그인 옵션에서 "다시 로그인 필요"를 "안 함"으로 바꿉니다.

## 4. 전원 설정 (몇 주 방치용)
- 설정 → 시스템 → 전원: 화면 끄기는 켜 둬도 되지만 **절전과 최대 절전은 "안 함"** (절전되면 접속 불가)
- BIOS에서 AC Behavior(전원 연결 시 자동 켜짐)를 켠 상태여야 합니다.

## 5. 집 밖에서 접속 (Tailscale)
1. 노트북과 폰에 Tailscale를 설치하고 같은 계정으로 로그인합니다.
2. 노트북 트레이의 Tailscale 아이콘 우클릭 → Preferences → **Run unattended** → Yes
3. 폰 브라우저에서 `http://<노트북의 100.x.x.x 주소>:8080` 으로 접속합니다.
4. 이 방식은 Tailscale 안에서만 열려 있으므로 포트포워딩은 하지 않습니다.

## 6. 한계
- 로그인 화면(비밀번호 입력 단계)은 이 프로그램이 조작하지 못합니다. 자동 로그인으로 그 단계를 없애는 방식입니다.
- 클립보드 버튼은 http 접속에서는 브라우저 제한으로 쓸 수 없습니다.
- 에이전트는 서버가 늦게 떠도 5초마다 다시 접속을 시도합니다.
