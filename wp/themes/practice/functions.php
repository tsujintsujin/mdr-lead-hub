<?php
// Block themes don't load style.css on the front end by themselves.
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('practice', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
});
add_action('after_setup_theme', function () {
    add_theme_support('editor-styles');
    add_editor_style('style.css');
});
