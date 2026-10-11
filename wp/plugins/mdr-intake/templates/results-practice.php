<?php defined('ABSPATH') || exit; ?>
<div class="mdr-results mdr--practice" data-mdr-results data-variant="practice" aria-live="polite">
    <div class="mdr-wait" data-waiting>
        <h2 class="mdr-results__title">Running your checkup</h2>
        <ol class="mdr-wait__steps">
            <li data-wait="open">Opening your website</li>
            <li data-wait="speed">Timing it on a phone</li>
            <li data-wait="seo">Reading what Google sees</li>
            <li data-wait="route">Finding the right strategist</li>
        </ol>
        <p class="mdr-wait__slow" data-slow hidden>This is taking longer than it should. Your answers are saved, and your strategist will email the results.</p>
    </div>

    <div class="mdr-chart" data-done hidden>
        <p class="mdr-chart__kicker">Checkup results</p>
        <h2 class="mdr-results__title" data-title></h2>
        <p class="mdr-chart__site" data-site></p>

        <div class="mdr-vitals">
            <div class="mdr-vital mdr-vital--speed">
                <p class="mdr-vital__label">Mobile speed</p>
                <p class="mdr-vital__value"><span data-speed>–</span><small>/100</small></p>
                <div class="mdr-meter" aria-hidden="true"><span data-speed-bar></span></div>
                <p class="mdr-vital__note">90 or above is quick. Under 50, and a lot of visitors leave before the page has finished.</p>
                <p class="mdr-vital__meta" data-speed-meta></p>
            </div>
            <div class="mdr-vital mdr-vital--checks">
                <p class="mdr-vital__label">Google basics</p>
                <p class="mdr-vital__value"><span data-checks-score>–</span></p>
                <ul class="mdr-checks" data-checks></ul>
            </div>
        </div>

        <p class="mdr-unreachable" data-unreachable hidden></p>
        <div class="mdr-rep" data-rep hidden></div>
    </div>

    <div data-missing hidden>
        <h2 class="mdr-results__title">We couldn’t find that checkup</h2>
        <p><a href="<?php echo esc_url(home_url('/#checkup')); ?>">Start a new one</a>. It takes about two minutes.</p>
    </div>
</div>
