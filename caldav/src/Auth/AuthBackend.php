<?php

namespace Ashfield\Caldav\Auth;

use Sabre\DAV\Auth\Backend\AbstractBasic;

/**
 * HTTP Basic 으로 들어온 username:password 를 우리 caldav_tokens 테이블에서 검증 (ADR-0014).
 *
 * username = user_sub, password = 평문 토큰 (cdv_xxxx).
 * DB 에는 bcrypt hash 만 저장. password_verify() 로 비교.
 *
 * 검증 통과 시:
 *   - validateUserPass 가 true 반환 → Sabre 가 currentUser 를 username 으로 set
 *   - last_used_at 갱신
 *   - company_id 는 Custom Backend 가 매 호출마다 DB 에서 fresh lookup (정적 캐시 X)
 */
class AuthBackend extends AbstractBasic
{
    protected $realm = 'Ashfield';

    public function __construct(private \PDO $db)
    {
    }

    /**
     * @return bool
     */
    protected function validateUserPass($username, $password)
    {
        $stmt = $this->db->prepare(
            'SELECT id, user_sub, company_id, secret_hash
             FROM caldav_tokens
             WHERE user_sub = :sub AND revoked_at IS NULL'
        );
        $stmt->execute([':sub' => $username]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            // bcrypt hash 는 Python bcrypt 가 $2b$ 포맷 — PHP password_verify 호환
            if (password_verify($password, $row['secret_hash'])) {
                // last_used_at 갱신 (비차단 — 실패해도 무시)
                try {
                    $upd = $this->db->prepare(
                        'UPDATE caldav_tokens SET last_used_at = NOW() WHERE id = :id'
                    );
                    $upd->execute([':id' => $row['id']]);
                } catch (\Throwable $e) {
                    // log only
                    error_log('caldav last_used_at 갱신 실패: ' . $e->getMessage());
                }

                return true;
            }
        }

        return false;
    }
}
