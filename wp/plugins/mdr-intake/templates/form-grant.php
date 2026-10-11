<?php defined('ABSPATH') || exit;
mdr_form('grant', [
    ['Your organization', [
        ['org_name', 'Organization name', 'text', ['required' => true]],
        ['website', 'Website', 'url', ['required' => true, 'placeholder' => 'yournonprofit.org']],
        ['ein', 'EIN (optional, it makes the IRS lookup exact)', 'ein', ['placeholder' => '12-3456789']],
        ['state', 'State', 'select', ['required' => true, 'options' => 'state']],
    ]],
    ['Where you are now', [
        ['nonprofit_status', 'Do you have 501(c)(3) status?', 'radios', ['required' => true, 'options' => 'nonprofit_status']],
        ['mission', 'What does your organization do?', 'select', ['required' => true, 'options' => 'mission']],
        ['grant_status', 'Do you already have Google Ad Grants?', 'radios', ['required' => true, 'options' => 'grant_status']],
        ['staff', 'How many paid staff?', 'radios', ['required' => true, 'options' => 'staff']],
        ['goals', 'What do you want more of? Pick any.', 'checks', ['required' => true, 'options' => 'grant_goal']],
        ['message', 'Anything else? (optional)', 'textarea'],
    ]],
    ['Who we’re talking to', [
        ['name', 'Your name', 'text', ['required' => true]],
        ['role', 'Your role (optional)', 'text', ['placeholder' => 'Executive director, development lead…']],
        ['email', 'Email', 'email', ['required' => true]],
        ['phone', 'Phone (optional)', 'tel'],
        ['consent', 'Yes, you can contact me about the results.', 'consent', ['required' => true]],
    ]],
], 'Check eligibility');
