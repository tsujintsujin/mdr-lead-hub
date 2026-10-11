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

$bar = gr_box([
    gr_html('<a class="gr-mark" href="/">Grant Ready</a>'),
    gr_html('<p class="gr-by">by Marketing Done Right</p>'),
], 'gr-bar', ['flex_direction' => 'row']);

$foot = gr_box([
    gr_html('<div class="gr-foot__row"><p>Marketing Done Right, Cleveland, Ohio</p><p>Demo built by Justin Masiga for Marketing Done Right</p></div>'),
], 'gr-foot');

$home = [
    $bar,
    gr_box([
        gr_html('<h1 class="gr-hero__title"><span class="gr-huge">$10,000</span><span class="gr-hero__line">a month in Google ads.</span><span class="gr-hero__free">Free, if you qualify.</span></h1>'),
        gr_text('<p>Google Ad Grants hands eligible nonprofits up to $10,000 in search ads every single month. Most of the ones that qualify never apply. Plenty that already have it barely touch it. Two minutes, and you’ll know which camp you’re in.</p>', 'gr-hero__sub'),
        gr_button('Check my nonprofit', '#check', 'gr-cta'),
        gr_text('<p>Free. We look up your IRS status for you.</p>', 'gr-hero__fine'),
    ], 'gr-hero'),
    gr_box([
        gr_heading('How the check works', 'h2', 'gr-h2'),
        gr_html('<ol class="gr-steps">
  <li><span class="gr-steps__n" aria-hidden="true">1</span><p>You tell us about your organization.</p></li>
  <li><span class="gr-steps__n" aria-hidden="true">2</span><p>We find you in the IRS nonprofit records and hold your website up against Google’s rules.</p></li>
  <li><span class="gr-steps__n" aria-hidden="true">3</span><p>You see where you stand straight away. Then an Ad Grants specialist follows up with what to do next.</p></li>
</ol>'),
    ], 'gr-how'),
    gr_box([
        gr_heading('Who Google says yes to', 'h2', 'gr-h2'),
        gr_html('<ul class="gr-rules">
  <li>US charities with 501(c)(3) status</li>
  <li>A working website on https, with real content about your mission</li>
  <li>Not a government agency, a hospital, a school or a university <span>(those go through other programs)</span></li>
</ul>'),
        gr_text('<p>Honestly, getting approved is the easy bit. Keeping the grant is harder. Google wants certain click-through numbers and account rules met every month, and that’s the part we take off your plate.</p>', 'gr-rules__after'),
    ], 'gr-yes'),
    gr_box([
        gr_inner([
            gr_heading('Check my nonprofit', 'h2', 'gr-h2'),
            gr_text('<p>Three steps. Your result shows up the moment you send it.</p><p class="gr-who">Marketing Done Right runs Ad Grants accounts for nonprofits in Ohio and further afield. We set them up, keep them on the right side of Google’s rules, and point the ads at what you actually need more of: donors, volunteers, people in your programs.</p>'),
        ], 'gr-check__intro'),
        gr_inner([
            gr_w('shortcode', ['shortcode' => '[mdr_intake variant="grant"]']),
        ], 'gr-check__form'),
    ], 'gr-check', ['flex_direction' => 'row', '_element_id' => 'check']),
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
