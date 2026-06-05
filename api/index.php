<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawResource = $_GET['resource'] ?? '';
$resourceParts = array_values(array_filter(explode('/', trim((string) $rawResource, '/'))));
$resource = $resourceParts[0] ?? '';
$id = $resourceParts[1] ?? ($_GET['id'] ?? null);
$payload = getJsonPayload();

$resources = [
    'customers' => [
        'table' => 'customers',
        'idField' => 'id',
        'map' => [
            'id' => 'id',
            'name' => 'name',
            'phone' => 'phone',
            'alternate_phone' => 'alternate_phone',
            'alternatePhone' => 'alternate_phone',
            'address' => 'address',
            'area' => 'area',
            'purifier_model' => 'purifier_model',
            'purifierModel' => 'purifier_model',
            'plan_id' => 'plan_id',
            'planId' => 'plan_id',
            'plan_name' => 'plan_name',
            'planName' => 'plan_name',
            'monthly_rent' => 'monthly_rent',
            'monthlyRent' => 'monthly_rent',
            'deposit_paid' => 'deposit_paid',
            'depositPaid' => 'deposit_paid',
            'initial_investment' => 'initial_investment',
            'initialInvestment' => 'initial_investment',
            'join_date' => 'join_date',
            'joinDate' => 'join_date',
            'next_due_date' => 'next_due_date',
            'nextDueDate' => 'next_due_date',
            'last_payment_date' => 'last_payment_date',
            'lastPaymentDate' => 'last_payment_date',
            'last_service_date' => 'last_service_date',
            'lastServiceDate' => 'last_service_date',
            'next_service_date' => 'next_service_date',
            'nextServiceDate' => 'next_service_date',
            'status' => 'status',
            'notes' => 'notes',
            'created_at' => 'created_at',
            'createdAt' => 'created_at',
        ],
    ],
    'plans' => [
        'table' => 'rental_plans',
        'idField' => 'id',
        'map' => [
            'id' => 'id',
            'name' => 'name',
            'monthly_rent' => 'monthly_rent',
            'monthlyRent' => 'monthly_rent',
            'deposit_amount' => 'deposit_amount',
            'depositAmount' => 'deposit_amount',
            'description' => 'description',
            'features' => 'features',
            'created_at' => 'created_at',
            'createdAt' => 'created_at',
        ],
    ],
    'service-records' => [
        'table' => 'service_records',
        'idField' => 'id',
        'map' => [
            'id' => 'id',
            'customer_id' => 'customer_id',
            'customerId' => 'customer_id',
            'customer_name' => 'customer_name',
            'customerName' => 'customer_name',
            'service_type' => 'service_type',
            'serviceType' => 'service_type',
            'service_date' => 'service_date',
            'serviceDate' => 'service_date',
            'next_service_date' => 'next_service_date',
            'nextServiceDate' => 'next_service_date',
            'technician_name' => 'technician_name',
            'technicianName' => 'technician_name',
            'parts_replaced' => 'parts_replaced',
            'partsReplaced' => 'parts_replaced',
            'notes' => 'notes',
            'cost' => 'cost',
            'created_at' => 'created_at',
            'createdAt' => 'created_at',
        ],
    ],
    'payments' => [
        'table' => 'payments',
        'idField' => 'id',
        'map' => [
            'id' => 'id',
            'customer_id' => 'customer_id',
            'customerId' => 'customer_id',
            'amount' => 'amount',
            'paid_date' => 'paid_date',
            'paidDate' => 'paid_date',
            'for_month' => 'for_month',
            'forMonth' => 'for_month',
            'notes' => 'notes',
            'created_at' => 'created_at',
            'createdAt' => 'created_at',
        ],
    ],
    'customer-comments' => [
        'table' => 'customer_comments',
        'idField' => 'id',
        'map' => [
            'id' => 'id',
            'customer_id' => 'customer_id',
            'customerId' => 'customer_id',
            'comment' => 'comment',
            'created_at' => 'created_at',
            'createdAt' => 'created_at',
        ],
    ],
];

if ($resource === '' || $resource === 'index.php') {
    sendJson([
        'message' => 'Pure Home Waters PHP API',
        'availableResources' => array_keys($resources),
    ]);
}

if ($resource === 'backups') {
    handleBackup();
}

if (!array_key_exists($resource, $resources)) {
    sendError('Unknown resource: ' . $resource, 404);
}

handleCrud(getDatabase(), $resources[$resource], $id, $payload);

function handleCrud(DatabaseInterface $db, array $meta, ?string $id, array $payload): void
{
    $table = $meta['table'];
    $idField = $meta['idField'];
    $fieldMap = $meta['map'];

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            if ($id !== null) {
                $row = $db->select("SELECT * FROM {$table} WHERE {$idField} = :id LIMIT 1", ['id' => $id], true);
                sendJson($row);
            }

            $rows = $db->select("SELECT * FROM {$table} ORDER BY {$idField} DESC");
            sendJson($rows);
            break;

        case 'POST':
            $data = filterRequestData($payload, $fieldMap);
            if (empty($data)) {
                sendError('No valid fields provided for create', 400);
            }
            $sql = buildInsertSql($table, $data);
            $insertId = $db->insert($sql, $data);
            sendJson(['success' => true, 'insertId' => $insertId], 201);
            break;

        case 'PUT':
        case 'PATCH':
            if ($id === null) {
                sendError('Missing resource ID for update', 400);
            }

            $data = filterRequestData($payload, $fieldMap);
            if (empty($data)) {
                sendError('No valid fields provided for update', 400);
            }

            $sql = buildUpdateSql($table, $data, $idField);
            $data['id'] = $id;
            $db->execute($sql, $data);
            sendJson(['success' => true, 'updatedId' => $id]);
            break;

        case 'DELETE':
            if ($id === null) {
                sendError('Missing resource ID for delete', 400);
            }
            $db->execute("DELETE FROM {$table} WHERE {$idField} = :id", ['id' => $id]);
            sendJson(['success' => true, 'deletedId' => $id]);
            break;

        default:
            sendError('Method not allowed', 405);
    }
}

function handleBackup(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendError('Backup endpoint accepts POST only', 405);
    }

    $payload = getJsonPayload();
    $sql = $payload['sql'] ?? '';
    if (!is_string($sql) || trim($sql) === '') {
        sendError('Missing sql content in backup payload', 400);
    }

    $fileName = $payload['fileName'] ?? sprintf('backup-%s.sql', date('Ymd-His'));
    $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($fileName));

    if (!is_dir(BACKUP_DIR) && !mkdir(BACKUP_DIR, 0755, true) && !is_dir(BACKUP_DIR)) {
        sendError('Unable to create backup directory', 500);
    }

    $filePath = BACKUP_DIR . '/' . $safeName;
    file_put_contents($filePath, $sql);

    sendJson([
        'success' => true,
        'message' => 'Backup saved',
        'fileName' => $safeName,
        'path' => $filePath,
    ]);
}

function buildInsertSql(string $table, array $data): string
{
    $fields = implode(', ', array_keys($data));
    $placeholders = implode(', ', array_map(static fn($field) => ':' . $field, array_keys($data)));
    return sprintf('INSERT INTO %s (%s) VALUES (%s)', $table, $fields, $placeholders);
}

function buildUpdateSql(string $table, array $data, string $idField): string
{
    $assignments = implode(', ', array_map(static fn($field) => sprintf('%s = :%s', $field, $field), array_keys($data)));
    return sprintf('UPDATE %s SET %s WHERE %s = :id', $table, $assignments, $idField);
}

function filterRequestData(array $payload, array $fieldMap): array
{
    $filtered = [];
    foreach ($payload as $key => $value) {
        if (!array_key_exists($key, $fieldMap)) {
            continue;
        }

        $fieldName = $fieldMap[$key];
        $filtered[$fieldName] = normalizeValue($value);
    }
    return $filtered;
}

function normalizeValue(mixed $value): mixed
{
    if ($value === '' || $value === null) {
        return null;
    }

    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    return $value;
}

function getJsonPayload(): array
{
    $body = file_get_contents('php://input');
    if ($body === false || trim($body) === '') {
        return [];
    }

    $payload = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendError('Invalid JSON payload: ' . json_last_error_msg(), 400);
    }

    return is_array($payload) ? $payload : [];
}

function sendJson(mixed $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function sendError(string $message, int $status = 400): void
{
    sendJson(['success' => false, 'error' => $message], $status);
}
