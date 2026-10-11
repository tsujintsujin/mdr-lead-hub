<?php defined('ABSPATH') || exit; ?>
<div class="mdr-results mdr--grant" data-mdr-results data-variant="grant" aria-live="polite">
    <div class="mdr-wait" data-waiting>
        <h2 class="mdr-results__title">Checking your eligibility</h2>
        <ol class="mdr-wait__steps">
            <li data-wait="open">Searching IRS nonprofit records</li>
            <li data-wait="speed">Opening your website</li>
            <li data-wait="seo">Checking Google’s rules</li>
            <li data-wait="route">Finding your specialist</li>
        </ol>
        <p class="mdr-wait__slow" data-slow hidden>This is taking longer than it should. Your answers are saved, and your specialist will email the results.</p>
    </div>

    <div class="mdr-verdict" data-done hidden>
        <h2 class="mdr-results__title" data-title></h2>
        <p class="mdr-stamp" data-stamp></p>
        <ul class="mdr-checks mdr-checks--grant" data-checks></ul>
        <p class="mdr-irs" data-irs hidden></p>
        <div class="mdr-rep" data-rep hidden></div>
    </div>

    <div data-missing hidden>
        <h2 class="mdr-results__title">We couldn’t find that check</h2>
        <p><a href="<?php echo esc_url(home_url('/#check')); ?>">Start a new one</a>. It takes about two minutes.</p>
    </div>
</div>
