<?php
/**
 * Plugin Name: MDR Intake
 * Description: Multi-step intake forms that hand each submission to n8n (signed), keep a local copy, retry if n8n is down, and show the visitor their live results.
 * Version: 1.0.0
 * Author: Justin Masiga
 * Requires PHP: 8.1
 *
 * Shortcodes: [mdr_intake variant="practice|grant"]  [mdr_results variant="practice|grant"]
 * REST (namespace mdr/v1):
 *   POST /submit          public   - the form posts here
 *   GET  /status/<token>  public   - the results page polls this
 *   POST /result          n8n only - signed callback with results (HMAC)
 * Constants (wp-config, set from Docker env): MDR_SITE, MDR_HMAC_SECRET, MDR_N8N_INTAKE
 */

defined('ABSPATH') || exit;

const MDR_VERSION = '1.0.0';
const MDR_CPT     = 'mdr_submission';

require_once __DIR__ . '/includes/fields.php';

/* ---------- storage: one private post per submission ---------- */

add_action('init', function () {
    register_post_type(MDR_CPT, [
        'label'        => 'Intake submissions',
        'labels'       => ['name' => 'Intake submissions', 'singular_name' => 'Submission', 'menu_name' => 'Intake'],
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => true,
        'menu_icon'    => 'dashicons-clipboard',
        'supports'     => ['title'],
        'capabilities' => ['create_posts' => 'do_not_allow'],
        'map_meta_cap' => true,
    ]);
});

/* ---------- signing (same scheme both directions) ---------- */

function mdr_sign(string $body, int $ts): string {
    return hash_hmac('sha256', $ts . '.' . $body, (string) MDR_HMAC_SECRET);
}

function mdr_verify(WP_REST_Request $req): bool {
    if (!defined('MDR_HMAC_SECRET') || MDR_HMAC_SECRET === '') return false;
    $ts  = (int) $req->get_header('x-mdr-timestamp');
    $sig = (string) $req->get_header('x-mdr-signature');
    if (!$ts || abs(time() - $ts) > 300) return false; // 5 min replay window
    return hash_equals(mdr_sign($req->get_body(), $ts), $sig);
}

/* ---------- REST routes ---------- */

add_action('rest_api_init', function () {
    register_rest_route('mdr/v1', '/submit', [
        'methods' => 'POST', 'callback' => 'mdr_rest_submit', 'permission_callback' => '__return_true',
    ]);
    register_rest_route('mdr/v1', '/status/(?P<token>[a-f0-9]{32})', [
        'methods' => 'GET', 'callback' => 'mdr_rest_status', 'permission_callback' => '__return_true',
    ]);
    register_rest_route('mdr/v1', '/result', [
        'methods' => 'POST', 'callback' => 'mdr_rest_result', 'permission_callback' => 'mdr_verify',
    ]);
});

function mdr_rest_submit(WP_REST_Request $req) {
    $p       = $req->get_json_params() ?: [];
    $variant = ($p['variant'] ?? '') === 'grant' ? 'grant' : 'practice';

    // Bots: hidden field filled, or the form was "filled" faster than a person can.
    if (!empty($p['company_url']) || (int) ($p['elapsed_ms'] ?? 0) < 2500) {
        return new WP_REST_Response(['ok' => true, 'token' => str_repeat('0', 32)], 200); // quiet success, nothing stored
    }

    // 6 submissions per IP per 10 minutes.
    $ipkey = 'mdr_rl_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    $hits  = (int) get_transient($ipkey);
    if ($hits >= 6) {
        return new WP_REST_Response(['ok' => false, 'error' => 'Too many tries from this connection. Wait a few minutes and send it again.'], 429);
    }
    set_transient($ipkey, $hits + 1, 10 * MINUTE_IN_SECONDS);

    [$fields, $errors] = mdr_clean_fields($variant, (array) ($p['fields'] ?? []));
    if ($errors) {
        return new WP_REST_Response(['ok' => false, 'errors' => $errors], 422);
    }

    $token   = bin2hex(random_bytes(16));
    $track   = mdr_clean_tracking((array) ($p['tracking'] ?? []));
    $payload = [
        'token'        => $token,
        'site'         => defined('MDR_SITE') ? MDR_SITE : 'unknown',
        'site_url'     => home_url('/'),
        'variant'      => $variant,
        'submitted_at' => gmdate('c'),
        'fields'       => $fields,
        'tracking'     => $track,
        'client'       => [
            'ip_hash'    => hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . wp_salt()),
            'user_agent' => substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ],
        'callback_url' => rest_url('mdr/v1/result'),
    ];

    $title   = ($fields['business'] ?? $fields['org_name'] ?? 'Submission') . ' — ' . ($fields['name'] ?? '');
    $post_id = wp_insert_post([
        'post_type' => MDR_CPT, 'post_status' => 'private', 'post_title' => $title,
    ]);
    update_post_meta($post_id, '_mdr_token', $token);
    update_post_meta($post_id, '_mdr_payload', wp_slash(wp_json_encode($payload)));
    update_post_meta($post_id, '_mdr_state', 'received');
    update_post_meta($post_id, '_mdr_attempts', 0);

    mdr_forward($post_id);

    return new WP_REST_Response(['ok' => true, 'token' => $token], 201);
}

/** Send one stored submission to n8n. Failure leaves it 'queued' for WP-Cron. */
function mdr_forward(int $post_id): bool {
    $body = (string) get_post_meta($post_id, '_mdr_payload', true);
    $ts   = time();
    $res  = wp_remote_post(MDR_N8N_INTAKE, [
        'timeout' => 6,
        'headers' => [
            'Content-Type'    => 'application/json',
            'X-MDR-Timestamp' => (string) $ts,
            'X-MDR-Signature' => mdr_sign($body, $ts),
        ],
        'body' => $body,
    ]);
    $attempts = (int) get_post_meta($post_id, '_mdr_attempts', true) + 1;
    update_post_meta($post_id, '_mdr_attempts', $attempts);
    $code = is_wp_error($res) ? 0 : (int) wp_remote_retrieve_response_code($res);
    if ($code >= 200 && $code < 300) {
        update_post_meta($post_id, '_mdr_state', 'forwarded');
        update_post_meta($post_id, '_mdr_forwarded_at', gmdate('c'));
        delete_post_meta($post_id, '_mdr_last_error');
        return true;
    }
    update_post_meta($post_id, '_mdr_state', 'queued');
    update_post_meta($post_id, '_mdr_last_error', is_wp_error($res) ? $res->get_error_message() : "HTTP $code");
    return false;
}

function mdr_find(string $token): int {
    $q = get_posts([
        'post_type' => MDR_CPT, 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids',
        'meta_key' => '_mdr_token', 'meta_value' => $token,
    ]);
    return $q ? (int) $q[0] : 0;
}

function mdr_rest_status(WP_REST_Request $req) {
    $id = mdr_find($req['token']);
    if (!$id) return new WP_REST_Response(['ok' => false, 'state' => 'unknown'], 404);
    $result = json_decode((string) get_post_meta($id, '_mdr_result', true), true) ?: null;
    return new WP_REST_Response([
        'ok'     => true,
        'state'  => get_post_meta($id, '_mdr_state', true),
        'result' => $result,
    ], 200);
}

/** n8n posts {token, stage, public:{...}} — 'audit' first, then 'routed'. Merged, never replaced. */
function mdr_rest_result(WP_REST_Request $req) {
    $p  = $req->get_json_params() ?: [];
    $id = mdr_find((string) ($p['token'] ?? ''));
    if (!$id) return new WP_REST_Response(['ok' => false], 404);
    $old = json_decode((string) get_post_meta($id, '_mdr_result', true), true) ?: [];
    $new = array_merge($old, (array) ($p['public'] ?? []));
    update_post_meta($id, '_mdr_result', wp_slash(wp_json_encode($new)));
    $stage = sanitize_key($p['stage'] ?? '');
    if (in_array($stage, ['audit', 'routed', 'failed'], true)) update_post_meta($id, '_mdr_state', $stage);
    if (!empty($p['lead_id'])) update_post_meta($id, '_mdr_lead_id', sanitize_text_field($p['lead_id']));
    if (!empty($p['verdict'])) update_post_meta($id, '_mdr_verdict', sanitize_key($p['verdict']));
    return new WP_REST_Response(['ok' => true], 200);
}

/* ---------- retry queue (WP-Cron, every 5 minutes) ---------- */

add_filter('cron_schedules', function ($s) {
    $s['mdr_five_minutes'] = ['interval' => 300, 'display' => 'Every 5 minutes'];
    return $s;
});
add_action('init', function () {
    if (!wp_next_scheduled('mdr_retry_queue')) wp_schedule_event(time() + 300, 'mdr_five_minutes', 'mdr_retry_queue');
});
add_action('mdr_retry_queue', function () {
    $ids = get_posts([
        'post_type' => MDR_CPT, 'post_status' => 'any', 'numberposts' => 20, 'fields' => 'ids',
        'meta_query' => [['key' => '_mdr_state', 'value' => 'queued']],
    ]);
    foreach ($ids as $id) {
        if ((int) get_post_meta($id, '_mdr_attempts', true) < 12) mdr_forward((int) $id); // ~1 hour of retries
    }
});
register_deactivation_hook(__FILE__, fn() => wp_clear_scheduled_hook('mdr_retry_queue'));

/* ---------- admin list ---------- */

add_filter('manage_' . MDR_CPT . '_posts_columns', fn($c) => [
    'cb' => $c['cb'], 'title' => 'Submission', 'mdr_state' => 'Status', 'mdr_verdict' => 'Verdict',
    'mdr_source' => 'Source', 'date' => 'Received',
]);
add_action('manage_' . MDR_CPT . '_posts_custom_column', function ($col, $id) {
    if ($col === 'mdr_state') {
        $s = get_post_meta($id, '_mdr_state', true);
        $labels = ['received' => 'Received', 'forwarded' => 'Sent to n8n', 'queued' => 'Waiting to retry', 'audit' => 'Audit done', 'routed' => 'Routed to a rep', 'failed' => 'Failed'];
        echo esc_html($labels[$s] ?? $s);
        $err = get_post_meta($id, '_mdr_last_error', true);
        if ($err && $s === 'queued') echo '<br><small>' . esc_html($err) . '</small>';
    }
    if ($col === 'mdr_verdict') echo esc_html(ucwords(str_replace('_', ' ', (string) get_post_meta($id, '_mdr_verdict', true))));
    if ($col === 'mdr_source') {
        $p = json_decode((string) get_post_meta($id, '_mdr_payload', true), true);
        $t = $p['tracking'] ?? [];
        echo esc_html(!empty($t['utm_source']) ? $t['utm_source'] : (!empty($t['gclid']) ? 'google ads' : 'direct'));
    }
}, 10, 2);

add_action('add_meta_boxes', function () {
    add_meta_box('mdr_payload', 'What was sent to n8n', function ($post) {
        $payload = json_decode((string) get_post_meta($post->ID, '_mdr_payload', true), true);
        $result  = json_decode((string) get_post_meta($post->ID, '_mdr_result', true), true);
        echo '<p><strong>Status:</strong> ' . esc_html(get_post_meta($post->ID, '_mdr_state', true)) .
             ' &nbsp; <strong>Attempts:</strong> ' . (int) get_post_meta($post->ID, '_mdr_attempts', true) . '</p>';
        echo '<pre style="white-space:pre-wrap;max-height:420px;overflow:auto">' . esc_html(wp_json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) . '</pre>';
        if ($result) echo '<h4>Results from n8n</h4><pre style="white-space:pre-wrap">' . esc_html(wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) . '</pre>';
    }, MDR_CPT, 'normal');
});

/* ---------- front end ---------- */

// Registered on init, not wp_enqueue_scripts: block themes render shortcodes before wp_head,
// and the config below must attach to an already-registered script.
add_action('init', function () {
    wp_register_script('mdr-intake', plugins_url('assets/intake.js', __FILE__), [], MDR_VERSION, true);
    $font = (defined('MDR_SITE') && MDR_SITE === 'site-b')
        ? 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
        : 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..600&family=Public+Sans:wght@400..700&display=swap';
    wp_register_style('mdr-fonts', $font, [], null);
    wp_register_style('mdr-intake', plugins_url('assets/intake.css', __FILE__), ['mdr-fonts'], MDR_VERSION);
});

add_action('wp_enqueue_scripts', fn() => wp_enqueue_style('mdr-fonts'));

function mdr_boot_script(string $variant, string $mode): void {
    wp_enqueue_style('mdr-intake');
    wp_enqueue_script('mdr-intake');
    wp_localize_script('mdr-intake', 'MDR_INTAKE', [
        'rest'       => esc_url_raw(rest_url('mdr/v1/')),
        'resultsUrl' => esc_url_raw(home_url('/results/')),
    ]);
}

add_shortcode('mdr_intake', function ($atts) {
    $a = shortcode_atts(['variant' => 'practice'], $atts);
    $variant = $a['variant'] === 'grant' ? 'grant' : 'practice';
    mdr_boot_script($variant, 'form');
    ob_start();
    include __DIR__ . '/templates/form-' . $variant . '.php';
    return ob_get_clean();
});

add_shortcode('mdr_results', function ($atts) {
    $a = shortcode_atts(['variant' => 'practice'], $atts);
    $variant = $a['variant'] === 'grant' ? 'grant' : 'practice';
    mdr_boot_script($variant, 'results');
    ob_start();
    include __DIR__ . '/templates/results-' . $variant . '.php';
    return ob_get_clean();
});
