<?php defined('ABSPATH') || exit;
mdr_form('practice', [
    ['Your practice', [
        ['business', 'Practice name', 'text', ['required' => true]],
        ['website', 'Website address', 'url', ['required' => true, 'placeholder' => 'yourpractice.com']],
        ['practice_type', 'What kind of practice is it?', 'select', ['required' => true, 'options' => 'practice_type']],
        ['zip', 'ZIP code of your main location', 'zip', ['required' => true]],
    ]],
    ['What you’re after', [
        ['goals', 'What would help most right now? Pick any.', 'checks', ['required' => true, 'options' => 'goals']],
        ['locations', 'How many locations?', 'radios', ['required' => true, 'options' => 'locations']],
        ['budget', 'Monthly marketing budget', 'select', ['required' => true, 'options' => 'budget']],
        ['timeline', 'When are you hoping to start?', 'radios', ['required' => true, 'options' => 'timeline']],
        ['message', 'Anything we should know? (optional)', 'textarea', ['placeholder' => 'A new associate starting in March, a second location on the way, an agency that let you down…']],
    ]],
    ['Where to send it', [
        ['name', 'Your name', 'text', ['required' => true]],
        ['email', 'Email', 'email', ['required' => true]],
        ['phone', 'Phone (optional)', 'tel'],
        ['consent', 'Yes, you can contact me about my results.', 'consent', ['required' => true]],
    ]],
], 'Run my checkup');
