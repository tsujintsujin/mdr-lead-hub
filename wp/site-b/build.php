<?php
/**
 * Builds Site B ("Grant Ready") in Elementor: Home and Results pages as
 * Elementor containers + widgets, plus the site CSS. Run by setup.sh:
 *   wp --path=/sites/b eval-file /repo/site-b/build.php
 * Safe to run again: pages are found by slug and rebuilt.
 */

update_option('elementor_experiment-container', 'active');
update_option('elementor_disable_color_schemes', 'yes');
update_option('elementor_disable_typography_schemes', 'yes');
update_option('elementor_load_fa4_shim', '');
update_option('elementor_element_cache_ttl', 'disable'); // rebuilds show up immediately

function gr_id() { return substr(bin2hex(random_bytes(4)), 0, 7); }

function gr_box(array $children, string $class = '', array $settings = []) {
    return [
        'id' => gr_id(), 'elType' => 'container', 'isInner' => false,
        'settings' => array_merge([
            'content_width' => 'full', 'flex_direction' => 'column', 'css_classes' => $class,
            'padding' => ['unit' => 'px', 'top' => '0', 'right' => '0', 'bottom' => '0', 'left' => '0', 'isLinked' => true],
            'flex_gap' => ['unit' => 'px', 'size' => 0, 'column' => '0', 'row' => '0'],
        ], $settings),
        'elements' => $children,
    ];
}
function gr_inner(array $children, string $class = '', array $settings = []) {
    $b = gr_box($children, $class, $settings);
    $b['isInner'] = true;
    return $b;
}
function gr_w(string $type, array $settings, string $class = '') {
    if ($class) $settings['_css_classes'] = $class;
    return ['id' => gr_id(), 'elType' => 'widget', 'widgetType' => $type, 'settings' => $settings, 'elements' => []];
}
function gr_heading(string $text, string $tag, string $class = '') { return gr_w('heading', ['title' => $text, 'header_size' => $tag], $class); }
function gr_text(string $html, string $class = '') { return gr_w('text-editor', ['editor' => $html], $class); }
function gr_html(string $html, string $class = '') { return gr_w('html', ['html' => $html], $class); }
function gr_button(string $text, string $url, string $class = '') { return gr_w('button', ['text' => $text, 'link' => ['url' => $url, 'is_external' => '', 'nofollow' => '']], $class); }

$check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

$bar = gr_box([
    gr_html('<div class="gr-head"><a class="gr-logo" href="/"><svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect width="28" height="28" rx="8" fill="#1E3A5F"/><path d="M8 14.5l4 4 8-9" stroke="#4ADE80" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Grant Ready<small>by Marketing Done Right</small></span></a><a class="gr-btn gr-btn--ghost" href="/#check">Check eligibility</a></div>'),
], 'gr-bar');

$foot = gr_box([
    gr_html('<div class="gr-foot__row"><p>Marketing Done Right, Cleveland, Ohio</p><p>Demo built by Justin Masiga for Marketing Done Right</p></div>'),
], 'gr-foot');

$home = [
    $bar,
    gr_box([
        gr_inner([
            gr_html('<span class="gr-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>Google Ad Grants for nonprofits</span>'),
            gr_heading('Your nonprofit could be getting $10,000 a month in free Google ads.', 'h1', 'gr-h1'),
            gr_text('<p>Google gives eligible charities up to $10,000 in search ads every month. Most that qualify never apply, and plenty that have it barely use it. Two minutes, and you’ll know where you stand.</p>', 'gr-lede'),
            gr_html('<a class="gr-btn gr-btn--green" href="#check">Check my nonprofit <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a><ul class="gr-trust"><li>' . $check . 'Free</li><li>' . $check . 'We look up your IRS status for you</li><li>' . $check . 'Results on the next screen</li></ul>'),
        ], 'gr-hero__copy'),
        gr_inner([
            gr_html('<figure class="gr-report" aria-label="Sample eligibility report">
  <div class="gr-report__head"><div><b>Eligibility report</b><small>Sample: Westside Food Pantry, Cleveland</small></div><span class="gr-badge gr-badge--likely">Likely eligible</span></div>
  <div class="gr-report__amount"><small>Available to you</small><div>$10,000 <span>/ month in search ads</span></div></div>
  <ul class="gr-report__checks">
    <li><span class="gr-ic gr-ic--ok">' . $check . '</span><div><b>Found in IRS nonprofit records</b><small>501(c)(3), Cleveland, OH</small></div></li>
    <li><span class="gr-ic gr-ic--ok">' . $check . '</span><div><b>Website loads on https</b><small>Google requires a secure site</small></div></li>
    <li><span class="gr-ic gr-ic--warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/></svg></span><div><b>Mission content is thin</b><small>About 180 words on the home page</small></div></li>
    <li><span class="gr-ic gr-ic--ok">' . $check . '</span><div><b>Organization type Google accepts</b><small>Not a school, hospital or agency</small></div></li>
  </ul>
  <figcaption>Yours will look like this, with your own results.</figcaption>
</figure>'),
        ], 'gr-hero__report'),
    ], 'gr-hero', ['flex_direction' => 'row']),
    gr_box([
        gr_heading('How the check works', 'h2', 'gr-h2'),
        gr_text('<p>Three short steps. No account, no sales call unless you ask for one.</p>', 'gr-sub'),
        gr_html('<ol class="gr-steps">
  <li><span class="gr-steps__n" aria-hidden="true">1</span><h3>Tell us about you</h3><p>Your organization, website and where you are with Ad Grants today.</p></li>
  <li><span class="gr-steps__n" aria-hidden="true">2</span><h3>We check the rules</h3><p>We find you in IRS nonprofit records and hold your website up against Google’s requirements.</p></li>
  <li><span class="gr-steps__n" aria-hidden="true">3</span><h3>See where you stand</h3><p>Your report shows up straight away, and an Ad Grants specialist follows up with next steps.</p></li>
</ol>'),
    ], 'gr-section'),
    gr_box([
        gr_heading('Who Google says yes to', 'h2', 'gr-h2'),
        gr_text('<p>Three requirements decide most applications.</p>', 'gr-sub'),
        gr_html('<ul class="gr-rules">
  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg><b>501(c)(3) status</b><span>A registered US charity with current IRS standing.</span></li>
  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg><b>A real website</b><span>Secure (https), working, with substance about your mission.</span></li>
  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/></svg><b>Not excluded</b><span>Government agencies, hospitals and schools go through other programs.</span></li>
</ul>'),
        gr_text('<p>Honestly, getting approved is the easy bit. Keeping the grant is harder: Google wants certain click-through numbers and account rules met every month, and that’s the part we take off your plate.</p>', 'gr-note'),
    ], 'gr-section gr-section--navy'),
    gr_box([
        gr_inner([
            gr_heading('Check my nonprofit', 'h2', 'gr-h2'),
            gr_text('<p>Three steps. Your result shows up the moment you send it.</p><p>Marketing Done Right runs Ad Grants accounts for nonprofits in Ohio and further afield. We set them up, keep them on the right side of Google’s rules, and point the ads at what you actually need more of: donors, volunteers, people in your programs.</p>', 'gr-who'),
        ], 'gr-check__intro'),
        gr_inner([
            gr_w('shortcode', ['shortcode' => '[mdr_intake variant="grant"]']),
        ], 'gr-check__form'),
    ], 'gr-section gr-check', ['flex_direction' => 'row', '_element_id' => 'check']),
    $foot,
];

$results = [
    $bar,
    gr_box([ gr_w('shortcode', ['shortcode' => '[mdr_results variant="grant"]']) ], 'gr-results'),
    $foot,
];

function gr_page(string $slug, string $title, array $data): int {
    $existing = get_page_by_path($slug, OBJECT, 'page');
    $id = $existing ? $existing->ID : wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $title]);
    wp_update_post(['ID' => $id, 'post_title' => $title, 'post_content' => '']);
    update_post_meta($id, '_elementor_edit_mode', 'builder');
    update_post_meta($id, '_elementor_template_type', 'wp-page');
    update_post_meta($id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
    update_post_meta($id, '_wp_page_template', 'elementor_canvas');
    update_post_meta($id, '_elementor_data', wp_slash(wp_json_encode($data)));
    delete_post_meta($id, '_elementor_css');
    delete_post_meta($id, '_elementor_element_cache');
    return (int) $id;
}

$home_id = gr_page('home', 'Grant Ready', $home);
gr_page('results', 'Your eligibility check', $results);
update_option('show_on_front', 'page');
update_option('page_on_front', $home_id);

// Site-wide CSS lives in the Customizer's Additional CSS (Elementor Free has no global custom CSS).
wp_update_custom_css_post(file_get_contents('/repo/site-b/site.css'), ['stylesheet' => get_stylesheet()]);

if (class_exists('\Elementor\Plugin')) \Elementor\Plugin::$instance->files_manager->clear_cache();
WP_CLI::success("Site B built (home $home_id)");
