<?php

/**
 * Ashfield CalDAV Server — Sabre/DAV 엔트리 (ADR-0014).
 *
 * 외부 캘린더 앱이 보낸 모든 CalDAV/WebDAV 요청 (PROPFIND, REPORT, GET, PUT, DELETE,
 * MKCALENDAR 등) 이 nginx → php-fpm 으로 라우팅돼 여기로 들어옴.
 *
 * 인증: HTTP Basic — username=user_sub, password=토큰 평문 (cdv_xxx).
 * 권한 분기: 토큰에 박힌 (user_sub, company_id) 로 회사 격리.
 */

require_once '/app/vendor/autoload.php';

use Ashfield\Caldav\Auth\AuthBackend;
use Ashfield\Caldav\Backend\CalendarBackend;
use Ashfield\Caldav\Backend\PrincipalBackend;

// ---------------------------------------------------------------------------
// DB 연결 — Postgres. backend 와 같은 DB.
// ---------------------------------------------------------------------------

$dsn = getenv('CALDAV_DB_DSN');
if (!$dsn) {
    http_response_code(500);
    header('Content-Type: text/plain');
    echo "CALDAV_DB_DSN env not configured\n";
    exit(1);
}

// PHP PDO pgsql driver 가 DSN 안의 user/password 를 무시하고 process user(www-data) 로
// libpq fallback 하는 환경이 있어 인증 실패. 명시적으로 분리해서 PDO 생성자 인자로 전달.
$pdoUser = null;
$pdoPass = null;
if (preg_match('/(?:^|;)\s*user=([^;]+)/', $dsn, $m)) {
    $pdoUser = $m[1];
}
if (preg_match('/(?:^|;)\s*password=([^;]+)/', $dsn, $m)) {
    $pdoPass = $m[1];
}

try {
    $pdo = new PDO($dsn, $pdoUser, $pdoPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_PERSISTENT => true,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    // 한글 company_id (예: '애쉬필드 개발') 비교가 client_encoding 불일치로 깨지는 걸 막음.
    // ATTR_PERSISTENT 라 connection reuse 돼도 매 request 시작에 명시적으로 보정.
    $pdo->exec("SET client_encoding = 'UTF8'");
} catch (PDOException $e) {
    http_response_code(503);
    header('Content-Type: text/plain');
    error_log('CalDAV DB connect 실패: ' . $e->getMessage());
    echo "Database unavailable\n";
    exit(1);
}

// ---------------------------------------------------------------------------
// Backend 인스턴스
// ---------------------------------------------------------------------------

$authBackend = new AuthBackend($pdo);
$principalBackend = new PrincipalBackend($pdo);
$calendarBackend = new CalendarBackend($pdo);

// ---------------------------------------------------------------------------
// Sabre Server tree
// ---------------------------------------------------------------------------

$nodes = [
    new \Sabre\CalDAV\Principal\Collection($principalBackend),
    new \Sabre\CalDAV\CalendarRoot($principalBackend, $calendarBackend),
];

$server = new \Sabre\DAV\Server($nodes);

// URL 의 prefix — nginx 가 /caldav/* 로 들어온 요청을 그대로 전달.
// Sabre 가 자기 URL 인식하게 baseUri 설정.
$server->setBaseUri('/caldav/');

// 핵심 plugins
$server->addPlugin(new \Sabre\DAV\Auth\Plugin($authBackend));
// Browser Plugin: dev 편의용 HTML 인덱스. 인증과 무관한 backend enumeration 을
// 일으켜 404 야기 사례 있어 운영 제거.
$server->addPlugin(new \Sabre\CalDAV\Plugin());
$server->addPlugin(new \Sabre\DAVACL\Plugin());
$server->addPlugin(new \Sabre\CalDAV\Schedule\Plugin());
$server->addPlugin(new \Sabre\DAV\Sharing\Plugin()); // 일반 sharing 먼저
$server->addPlugin(new \Sabre\CalDAV\SharingPlugin());
$server->addPlugin(new \Sabre\DAV\Sync\Plugin());

// 실행
$server->start();
