<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

interface DatabaseInterface
{
    public function select(string $sql, array $params = [], bool $single = false): array;
    public function execute(string $sql, array $params = []): bool;
    public function insert(string $sql, array $params = []): int;
    public function lastInsertId(): int;
    public function isMock(): bool;
}

abstract class AbstractDatabase implements DatabaseInterface
{
    protected bool $mock = false;

    public function isMock(): bool
    {
        return $this->mock;
    }
}

class MySqlDatabase extends AbstractDatabase
{
    private \PDO $pdo;

    public function __construct(array $config)
    {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['dbname'],
            $config['charset']
        );

        $this->pdo = new \PDO($dsn, $config['user'], $config['pass'], [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }

    public function select(string $sql, array $params = [], bool $single = false): array
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        return $single ? ($rows[0] ?? []) : $rows;
    }

    public function execute(string $sql, array $params = []): bool
    {
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }

    public function insert(string $sql, array $params = []): int
    {
        $this->execute($sql, $params);
        return $this->lastInsertId();
    }

    public function lastInsertId(): int
    {
        return (int) $this->pdo->lastInsertId();
    }
}

class MockDatabase extends AbstractDatabase
{
    private static int $nextId = 1000;

    public function __construct()
    {
        $this->mock = true;
    }

    public function select(string $sql, array $params = [], bool $single = false): array
    {
        return $single ? [] : [];
    }

    public function execute(string $sql, array $params = []): bool
    {
        return true;
    }

    public function insert(string $sql, array $params = []): int
    {
        return ++self::$nextId;
    }

    public function lastInsertId(): int
    {
        return self::$nextId;
    }
}

function getDatabase(): DatabaseInterface
{
    try {
        return new MySqlDatabase([
            'host' => DB_HOST,
            'port' => DB_PORT,
            'dbname' => DB_NAME,
            'user' => DB_USER,
            'pass' => DB_PASS,
            'charset' => DB_CHARSET,
        ]);
    } catch (\Throwable $exception) {
        return new MockDatabase();
    }
}
