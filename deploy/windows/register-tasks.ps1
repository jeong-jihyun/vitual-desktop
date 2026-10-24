# 부팅(로그온) 시 서버와 호스트 에이전트를 자동 실행하도록 작업 스케줄러에 등록한다.
# 사용법: 시작 메뉴에서 PowerShell을 "관리자 권한으로" 열고
#   cd <이 저장소 폴더>\deploy\windows
#   Set-ExecutionPolicy -Scope Process Bypass
#   .\register-tasks.ps1
# 해제: .\register-tasks.ps1 -Remove
param([switch]$Remove)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$serverDir = Join-Path $repo "server"
$agentDir  = Join-Path $repo "host-agent"
$user = "$env:USERDOMAIN\$env:USERNAME"
$names = @("DeskControl-Server", "DeskControl-Agent")

if ($Remove) {
    foreach ($n in $names) { Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Host "작업을 해제했습니다."
    exit 0
}

# 실행 파일 찾기
$node = (Get-Command node -ErrorAction Stop).Source
$venvPy = Join-Path $agentDir "venv\Scripts\python.exe"
$python = if (Test-Path $venvPy) { $venvPy } else { (Get-Command python -ErrorAction Stop).Source }

# 사전 점검
if (-not (Test-Path (Join-Path $serverDir ".env")))  { throw "server\.env 가 없습니다. server\.env.example 을 복사해 값을 채우세요." }
if (-not (Test-Path (Join-Path $repo "web-client\dist"))) { throw "web-client\dist 가 없습니다. web-client 폴더에서 npm install 후 npm run build 를 먼저 하세요." }
if (-not (Test-Path (Join-Path $agentDir "device_config.json"))) {
    Write-Warning "device_config.json 이 없습니다. 에이전트를 한 번 직접 실행해 페어링한 뒤에 자동 실행이 완전히 동작합니다."
}

$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew -StartWhenAvailable

function Register-Logon($name, $exe, $arguments, $workDir, $delay) {
    $action = New-ScheduledTaskAction -Execute $exe -Argument $arguments -WorkingDirectory $workDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
    $trigger.Delay = $delay
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal `
        -Settings $settings -Force | Out-Null
    Write-Host "등록됨: $name"
}

# 서버는 로그온 10초 뒤, 에이전트는 서버가 뜬 뒤인 30초 뒤에 시작
Register-Logon "DeskControl-Server" $node "src/index.js" $serverDir "PT10S"
Register-Logon "DeskControl-Agent" $python "agent.py --http http://localhost:8080 --ws ws://localhost:8080" $agentDir "PT30S"

Write-Host ""
Write-Host "완료. 다음 로그온부터 자동으로 실행됩니다. 지금 바로 시험하려면:"
Write-Host "  Start-ScheduledTask DeskControl-Server; Start-Sleep 25; Start-ScheduledTask DeskControl-Agent"
