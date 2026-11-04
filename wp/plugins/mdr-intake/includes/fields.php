<?php
/**
 * The two forms' fields: the option lists the templates render and the rules
 * the server checks. One definition, so the form and the validation can't drift.
 */

defined('ABSPATH') || exit;

function mdr_options(): array {
    return [
        'practice_type' => [
            'chiropractic' => 'Chiropractic', 'physical_therapy' => 'Physical therapy',
            'med_spa' => 'Med spa', 'dental' => 'Dental', 'massage_wellness' => 'Massage or wellness',
            'other_health' => 'Another kind of practice',
        ],
        'goals' => [
            'new_patients' => 'More new patients', 'rank_google' => 'Show up higher on Google',
            'run_ads' => 'Run Google or Facebook ads', 'new_website' => 'A new website',
            'reviews' => 'More reviews',
        ],
        'locations' => ['1' => 'One', '2_3' => 'Two or three', '4_plus' => 'Four or more'],
        'budget' => [
            'under_500' => 'Under $500', '500_1500' => '$500 to $1,500',
            '1500_5000' => '$1,500 to $5,000', '5000_plus' => 'Over $5,000', 'unsure' => 'Not sure yet',
        ],
        'timeline' => ['asap' => 'As soon as possible', 'quarter' => 'In the next three months', 'exploring' => 'Just looking around'],

        'nonprofit_status' => ['yes' => 'Yes, we have IRS 501(c)(3) status', 'pending' => 'We applied, still waiting', 'no' => 'No', 'unsure' => 'Not sure'],
        'mission' => [
            'human_services' => 'Human services', 'education_programs' => 'Education programs',
            'health_programs' => 'Health programs', 'arts_culture' => 'Arts and culture',
            'environment_animals' => 'Environment or animals', 'community' => 'Community development',
            'religious' => 'Faith-based', 'hospital_school_gov' => 'A hospital, school or government agency',
            'other' => 'Something else',
        ],
        'grant_status' => ['no' => 'No', 'underused' => 'Yes, but we barely use it', 'active' => 'Yes, and it runs well'],
        'staff' => ['volunteers' => 'All volunteers', '1_5' => '1 to 5', '6_25' => '6 to 25', '26_plus' => 'More than 25'],
        'grant_goal' => [
            'donors' => 'More donors', 'volunteers' => 'More volunteers', 'signups' => 'More people in our programs',
            'awareness' => 'More people knowing we exist',
        ],
        'state' => array_combine(
            $s = ['OH','AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'],
            $s
        ),
    ];
}

/** [field => [type, required, option-list key]] per form. */
function mdr_schema(string $variant): array {
    $contact = [
        'name'    => ['text', true],
        'email'   => ['email', true],
        'phone'   => ['phone', false],
        'consent' => ['bool', true],
    ];
    if ($variant === 'grant') {
        return [
            'org_name'         => ['text', true],
            'website'          => ['url', true],
            'ein'              => ['ein', false],
            'state'            => ['choice', true, 'state'],
            'nonprofit_status' => ['choice', true, 'nonprofit_status'],
            'mission'          => ['choice', true, 'mission'],
            'grant_status'     => ['choice', true, 'grant_status'],
            'staff'            => ['choice', true, 'staff'],
            'goals'            => ['multi', true, 'grant_goal'],
            'message'          => ['long', false],
            'role'             => ['text', false],
        ] + $contact;
    }
    return [
        'business'      => ['text', true],
        'website'       => ['url', true],
        'practice_type' => ['choice', true, 'practice_type'],
        'zip'           => ['zip', true],
        'goals'         => ['multi', true, 'goals'],
        'locations'     => ['choice', true, 'locations'],
        'budget'        => ['choice', true, 'budget'],
        'timeline'      => ['choice', true, 'timeline'],
        'message'       => ['long', false],
    ] + $contact;
}

/** @return array{0: array, 1: array} [clean fields, errors keyed by field] */
function mdr_clean_fields(string $variant, array $in): array {
    $opts = mdr_options();
    $out = [];
    $err = [];
    foreach (mdr_schema($variant) as $key => $rule) {
        [$type, $required] = $rule;
        $list = isset($rule[2]) ? $opts[$rule[2]] : [];
        $raw  = $in[$key] ?? null;
        $val  = null;
        switch ($type) {
            case 'text':  $val = mb_substr(trim(sanitize_text_field((string) $raw)), 0, 120); break;
            case 'long':  $val = mb_substr(trim(sanitize_textarea_field((string) $raw)), 0, 2000); break;
            case 'email': $val = sanitize_email((string) $raw); if ($val && !is_email($val)) { $err[$key] = 'That email address looks incomplete.'; } break;
            case 'phone': $val = preg_replace('/[^0-9+()\- .]/', '', (string) $raw); $val = mb_substr(trim($val), 0, 25); break;
            case 'zip':   $val = preg_match('/^\d{5}$/', trim((string) $raw)) ? trim((string) $raw) : ''; if ($raw && !$val) $err[$key] = 'Use a 5-digit ZIP code.'; break;
            case 'ein':   $d = preg_replace('/\D/', '', (string) $raw); $val = strlen($d) === 9 ? substr($d, 0, 2) . '-' . substr($d, 2) : ''; if ($raw && !$val) $err[$key] = 'An EIN has 9 digits, like 12-3456789.'; break;
            case 'url':
                $u = trim((string) $raw);
                if ($u !== '' && !preg_match('#^https?://#i', $u)) $u = 'https://' . $u;
                $val = esc_url_raw($u, ['http', 'https']);
                $host = $val ? (string) parse_url($val, PHP_URL_HOST) : '';
                if ($u !== '' && (!$val || !filter_var($val, FILTER_VALIDATE_URL) || !str_contains($host, '.'))) { $err[$key] = 'Enter the address of your website, like yourpractice.com.'; $val = ''; }
                break;
            case 'choice': $val = isset($list[(string) $raw]) ? (string) $raw : ''; break;
            case 'multi':  $val = array_values(array_intersect(array_map('strval', (array) $raw), array_keys($list))); break;
            case 'bool':   $val = !empty($raw) && $raw !== 'false'; break;
        }
        $empty = $val === '' || $val === null || $val === [] || $val === false;
        if ($required && $empty && !isset($err[$key])) {
            $err[$key] = $type === 'bool' ? 'Tick the box so we can contact you.' : 'This one is needed.';
        }
        $out[$key] = $val;
    }
    return [$out, $err];
}

function mdr_clean_tracking(array $t): array {
    $keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'referrer', 'landing_page'];
    $out = [];
    foreach ($keys as $k) $out[$k] = mb_substr(sanitize_text_field((string) ($t[$k] ?? '')), 0, 300);
    return $out;
}

/** Render one field. $f = [key, label, kind, extra]; kind: text|email|tel|url|zip|ein|select|radios|checks|textarea|consent */
function mdr_field(array $f): void {
    [$key, $label, $kind] = $f;
    $x    = $f[3] ?? [];
    $opts = isset($x['options']) ? mdr_options()[$x['options']] : [];
    $req  = !empty($x['required']);
    $id   = 'mdr-' . $key;
    $ph   = isset($x['placeholder']) ? ' placeholder="' . esc_attr($x['placeholder']) . '"' : '';
    $r    = $req ? ' required aria-required="true"' : '';
    $err  = ' aria-describedby="' . esc_attr($id) . '-error"';
    echo '<div class="mdr-field mdr-field--' . esc_attr($kind) . '" data-field="' . esc_attr($key) . '"' . ($req ? ' data-required' : '') . '>';
    if (in_array($kind, ['radios', 'checks'], true)) {
        echo '<fieldset' . $err . '><legend>' . esc_html($label) . '</legend><div class="mdr-choices">';
        foreach ($opts as $v => $t) {
            $type = $kind === 'radios' ? 'radio' : 'checkbox';
            echo '<label class="mdr-choice"><input type="' . $type . '" name="' . esc_attr($key) . '" value="' . esc_attr($v) . '"><span>' . esc_html($t) . '</span></label>';
        }
        echo '</div></fieldset>';
    } elseif ($kind === 'consent') {
        echo '<label class="mdr-consent"><input type="checkbox" name="' . esc_attr($key) . '" value="1"' . $err . '><span>' . esc_html($label) . '</span></label>';
    } else {
        echo '<label for="' . esc_attr($id) . '">' . esc_html($label) . '</label>';
        if ($kind === 'select') {
            echo '<select id="' . esc_attr($id) . '" name="' . esc_attr($key) . '"' . $err . '><option value="">Choose one</option>';
            foreach ($opts as $v => $t) echo '<option value="' . esc_attr($v) . '">' . esc_html($t) . '</option>';
            echo '</select>';
        } elseif ($kind === 'textarea') {
            echo '<textarea id="' . esc_attr($id) . '" name="' . esc_attr($key) . '" rows="3"' . $ph . '></textarea>';
        } else {
            $more = [
                'email' => ' type="email" autocomplete="email"',
                'tel'   => ' type="tel" autocomplete="tel"',
                'url'   => ' type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false"',
                'zip'   => ' type="text" inputmode="numeric" maxlength="5" autocomplete="postal-code"',
                'ein'   => ' type="text" inputmode="numeric" maxlength="10"',
            ][$kind] ?? ' type="text"';
            if ($key === 'name') $more .= ' autocomplete="name"';
            if (in_array($key, ['business', 'org_name'], true)) $more .= ' autocomplete="organization"';
            echo '<input id="' . esc_attr($id) . '" name="' . esc_attr($key) . '"' . $more . $ph . $err . '>';
        }
    }
    echo '<p class="mdr-error" id="' . esc_attr($id) . '-error" hidden></p></div>';
}

/** The whole multi-step form. $steps = [[title, [fields...]], ...] */
function mdr_form(string $variant, array $steps, string $submit_label): void {
    $n = count($steps);
    echo '<form class="mdr mdr--' . esc_attr($variant) . '" data-mdr-form data-variant="' . esc_attr($variant) . '" novalidate>';
    echo '<div class="mdr-progress" aria-hidden="true"><span class="mdr-progress__bar"></span></div>';
    // Bot trap. display:none and a meaningless name, so browser autofill never fills it
    // (an off-screen field named company_url was being autofilled with the visitor's website).
    echo '<div class="mdr-hp" hidden aria-hidden="true"><label>Leave this empty <input type="text" name="mdr_hp" tabindex="-1" autocomplete="off" data-lpignore="true" data-1p-ignore></label></div>';
    foreach ($steps as $i => [$title, $fields]) {
        $s = $i + 1;
        echo '<section class="mdr-step" data-step="' . $s . '"' . ($i ? ' hidden' : '') . ' aria-labelledby="mdr-step-' . $s . '">';
        echo '<p class="mdr-step__count">Step ' . $s . ' of ' . $n . '</p>';
        echo '<h3 class="mdr-step__title" id="mdr-step-' . $s . '" tabindex="-1">' . esc_html($title) . '</h3>';
        foreach ($fields as $f) mdr_field($f);
        echo '<div class="mdr-nav">';
        if ($i) echo '<button type="button" class="mdr-btn mdr-btn--back" data-back>Back</button>';
        echo $s < $n
            ? '<button type="button" class="mdr-btn mdr-btn--next" data-next>Next</button>'
            : '<button type="submit" class="mdr-btn mdr-btn--submit" data-submit>' . esc_html($submit_label) . '</button>';
        echo '</div></section>';
    }
    echo '<p class="mdr-send-error" role="alert" hidden>That didn&rsquo;t go through. Check your connection and try once more.</p>';
    echo '</form>';
}
