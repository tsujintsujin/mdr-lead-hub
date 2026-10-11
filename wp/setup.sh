#!/bin/sh
# One-command setup for both WordPress sites with WP-CLI. Safe to run again.
# Run from the repo root:  MSYS_NO_PATHCONV=1 docker compose run --rm cli sh /repo/setup.sh
set -e

A="wp --path=/sites/a"
B="wp --path=/sites/b"

page() { # page <wp> <slug> <title> <content> -> prints id, creates or updates
  WP="$1"; id=$($WP post list --post_type=page --name="$2" --field=ID --post_status=publish | head -n1)
  if [ -z "$id" ]; then id=$($WP post create --post_type=page --post_status=publish --post_name="$2" --post_title="$3" --post_content="$4" --porcelain)
  else $WP post update "$id" --post_title="$3" --post_content="$4" >/dev/null; fi
  echo "$id"
}

common() { # common <wp> <tagline>
  WP="$1"
  $WP option update blogdescription "$2"
  $WP option update timezone_string "America/New_York"
  $WP rewrite structure '/%postname%/' --hard
  $WP plugin activate mdr-intake
  $WP plugin delete akismet hello >/dev/null 2>&1 || true
  $WP post delete 1 2 3 --force >/dev/null 2>&1 || true   # sample post, sample page, privacy draft
  $WP option update blog_public 0
}

echo "== Site A: Practice Growth Check (Gutenberg block theme)"
common "$A" "A free website checkup for clinics, from Marketing Done Right"
$A theme activate practice
$A theme delete twentytwentythree twentytwentyfour >/dev/null 2>&1 || true
page "$A" results "Your checkup" '<!-- wp:shortcode -->[mdr_results variant="practice"]<!-- /wp:shortcode -->' >/dev/null
$A option update show_on_front posts   # front-page.html template renders the home page

echo "== Site B: Grant Ready (Elementor)"
common "$B" "Free Google Ad Grants eligibility check for nonprofits, from Marketing Done Right"
$B theme is-installed hello-elementor || $B theme install hello-elementor
$B theme activate hello-elementor
$B plugin is-installed elementor || $B plugin install elementor
$B plugin activate elementor
$B theme delete twentytwentythree twentytwentyfour twentytwentyfive >/dev/null 2>&1 || true
$B eval-file /repo/site-b/build.php

echo "done"
