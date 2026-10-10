<?php

namespace Ashfield\Caldav\Backend;

use Sabre\DAVACL\PrincipalBackend\AbstractBackend;
use Sabre\DAV\PropPatch;

/**
 * Principal = Sabre 의 user 식별자. 우리에겐 user_sub (Better Auth 사용자 ID = users.id) 가 곧 principal.
 *
 * principal URI 규약: 'principals/{user_sub}'
 *
 * Group / sharee 기능은 미구현 (Phase 1). 캘린더 공유는 우리 도메인의 scope=shared
 * 에서 처리.
 */
class PrincipalBackend extends AbstractBackend
{
    public function __construct(private \PDO $db)
    {
    }

    public function getPrincipalsByPrefix($prefixPath): array
    {
        // Sabre 의 PrincipalCollection 이 'principals' 로 호출. legacy 'principals/users' 도 허용.
        if ($prefixPath !== 'principals' && $prefixPath !== 'principals/users') {
            return [];
        }
        // 현재 인증된 토큰 user 만 노출. 다른 user 의 principal 은 보일 필요 없음.
        $userSub = $this->currentUserSub();
        if ($userSub === null) {
            return [];
        }
        $p = $this->makePrincipal($userSub);
        return $p === null ? [] : [$p];
    }

    /**
     * 현 request 의 인증된 user_sub. HTTP Basic Authorization 헤더에서 추출.
     * $_SERVER 는 request-scoped — process memory stale 위험 없음.
     */
    private function currentUserSub(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (stripos($auth, 'Basic ') !== 0) {
            return null;
        }
        $decoded = base64_decode(substr($auth, 6), true);
        if ($decoded === false || !str_contains($decoded, ':')) {
            return null;
        }
        [$user] = explode(':', $decoded, 2);
        return $user !== '' ? $user : null;
    }

    public function getPrincipalByPath($path): ?array
    {
        // 'principals/{user_sub}'
        if (!str_starts_with($path, 'principals/')) {
            return null;
        }
        $userSub = substr($path, strlen('principals/'));
        if ($userSub === '') {
            return null;
        }
        // user 가 DB 에 있는지 확인. 보안: 다른 user 의 캘린더는 Calendar Backend
        // 에서 회사 격리로 차단되므로 principal URI 노출 자체는 무해.
        return $this->makePrincipal($userSub);
    }

    public function updatePrincipal($path, PropPatch $propPatch): void
    {
        // Principal 메타 수정 미지원. 모든 prop change 거부.
    }

    public function searchPrincipals($prefixPath, array $searchProperties, $test = 'allof'): array
    {
        return [];
    }

    public function findByUri($uri, $principalPrefix): ?string
    {
        return null;
    }

    public function getGroupMemberSet($principal): array
    {
        return [];
    }

    public function getGroupMembership($principal): array
    {
        return [];
    }

    public function setGroupMemberSet($principal, array $members): void
    {
        // 미지원
    }

    /**
     * user_sub → principal row. user 가 DB 에 없으면 null.
     */
    private function makePrincipal(string $userSub): ?array
    {
        $email = '';
        $name = $userSub;
        try {
            $stmt = $this->db->prepare(
                'SELECT email, name FROM users WHERE id = :sub'
            );
            $stmt->execute([':sub' => $userSub]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            if ($row === false) {
                return null;
            }
            $email = $row['email'] ?? '';
            $name = $row['name'] ?: $userSub;
        } catch (\Throwable $e) {
            return null;
        }

        return [
            'uri' => 'principals/' . $userSub,
            '{DAV:}displayname' => $name,
            '{http://sabredav.org/ns}email-address' => $email,
        ];
    }
}
