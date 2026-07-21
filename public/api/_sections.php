<?php
// The content schema — the single declaration of every dashboard-editable
// section. PHP validates writes against this, and the admin UI renders its forms
// from the very same structure (served by content.php?schema=1), so the two can
// never drift apart.
//
// To add a field: add it here. To add a whole section: add an entry here and a
// matching seed in data/. No PHP and no React needs to change either way.
//
// Deliberately NOT here: navigation (community's topLinks/sideLinks, the site
// nav) and structural microcopy. Those are load-bearing for layout and stay in
// code. See the tiering note in the section comments below.

function content_sections(): array
{
    return [

        // ------------------------------------------------------------ contact
        'contact' => [
            'label'  => 'Contact & booking',
            'blurb'  => 'Shown on the contact page and in the site footer.',
            'fields' => [
                'intro' => [
                    'kind'   => 'group',
                    'label'  => 'Page intro',
                    'fields' => [
                        'title' => [
                            'kind'      => 'text',
                            'label'     => 'Title',
                            'maxLength' => 60,
                            'help'      => 'Kept short — this is the page heading.',
                        ],
                        'lead' => [
                            'kind'      => 'textarea',
                            'label'     => 'Lead paragraph',
                            'maxLength' => 300,
                        ],
                        'note' => [
                            'kind'      => 'textarea',
                            'label'     => 'Supporting note',
                            'maxLength' => 300,
                        ],
                    ],
                ],
                'items' => [
                    'kind'     => 'list',
                    'label'    => 'Contact details',
                    'help'     => 'Email and Phone are turned into working links automatically.',
                    'maxItems' => 12,
                    'of' => [
                        'kind'   => 'group',
                        'fields' => [
                            'label' => ['kind' => 'text', 'label' => 'Label', 'maxLength' => 40],
                            'value' => ['kind' => 'text', 'label' => 'Value', 'maxLength' => 200],
                        ],
                    ],
                ],
            ],
        ],

        // ------------------------------------------------------------- social
        'social' => [
            'label' => 'Social links',
            'blurb' => 'Used by the home hero and the footer. Leave a URL blank to '
                     . 'hide that platform rather than render a dead link.',
            'fields' => [
                'links' => [
                    'kind'     => 'list',
                    'label'    => 'Platforms',
                    'maxItems' => 12,
                    'of' => [
                        'kind'   => 'group',
                        'fields' => [
                            'id'    => ['kind' => 'text', 'label' => 'ID', 'maxLength' => 30,
                                        'help' => 'Lowercase key used to pick the icon, e.g. youtube.'],
                            'label' => ['kind' => 'text', 'label' => 'Display name', 'maxLength' => 40],
                            'url'   => ['kind' => 'url', 'label' => 'Profile URL', 'nullable' => true],
                        ],
                    ],
                ],
            ],
        ],

        // ------------------------------------------------------------ members
        'members' => [
            'label' => 'Choir members',
            'blurb' => 'The roster on the About page. Photos upload to the server; '
                     . 'portrait crops read best.',
            'fields' => [
                'members' => [
                    'kind'     => 'list',
                    'label'    => 'Members',
                    'maxItems' => 200,
                    'of' => [
                        'kind'   => 'group',
                        'fields' => [
                            'name'   => ['kind' => 'text', 'label' => 'Name', 'maxLength' => 80],
                            'voice'  => ['kind' => 'text', 'label' => 'Voice part', 'maxLength' => 60],
                            'photo'  => ['kind' => 'image', 'label' => 'Photo', 'upload' => 'members'],
                            'church' => ['kind' => 'text', 'label' => 'Church', 'maxLength' => 80],
                        ],
                    ],
                ],
            ],
        ],

        // --------------------------------------------------------------- join
        'join' => [
            'label' => 'Join page',
            'blurb' => 'The membership pathway. Rehearsal time is not here — it comes '
                     . 'from Contact & booking so it is only ever edited once.',
            'fields' => [
                'eyebrow' => ['kind' => 'text', 'label' => 'Eyebrow', 'maxLength' => 40],
                'title'   => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 70,
                              'help' => 'Kept short so the hero heading wraps cleanly.'],
                'lead'    => ['kind' => 'textarea', 'label' => 'Lead paragraph', 'maxLength' => 320],
                'backgroundImage' => ['kind' => 'image', 'label' => 'Background image', 'upload' => 'site'],
                'rehearsalNote'   => ['kind' => 'text', 'label' => 'Rehearsal note', 'maxLength' => 160],
                'pathways' => [
                    'kind' => 'list', 'label' => 'Pathways', 'maxItems' => 8,
                    'of' => ['kind' => 'group', 'fields' => [
                        'title' => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 60],
                        'copy'  => ['kind' => 'textarea', 'label' => 'Description', 'maxLength' => 300],
                    ]],
                ],
                'steps' => [
                    'kind' => 'list', 'label' => 'Steps', 'maxItems' => 10,
                    'of' => ['kind' => 'text', 'maxLength' => 200],
                ],
                'values' => [
                    'kind' => 'list', 'label' => 'What we look for', 'maxItems' => 10,
                    'of' => ['kind' => 'text', 'maxLength' => 120],
                ],
                'voiceOptions' => [
                    'kind' => 'list', 'label' => 'Voice options', 'maxItems' => 20,
                    'help' => 'The choices in the application form’s voice-part dropdown.',
                    'of' => ['kind' => 'text', 'maxLength' => 60],
                ],
            ],
        ],

        // ------------------------------------------------------- partnerships
        'partnerships' => [
            'label'  => 'Partnerships page',
            'fields' => [
                'eyebrow' => ['kind' => 'text', 'label' => 'Eyebrow', 'maxLength' => 40],
                'title'   => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 90],
                'lead'    => ['kind' => 'textarea', 'label' => 'Lead paragraph', 'maxLength' => 320],
                'backgroundImage' => ['kind' => 'image', 'label' => 'Background image', 'upload' => 'site'],
                'highlight' => [
                    'kind' => 'group', 'label' => 'Highlight card',
                    'fields' => [
                        'label' => ['kind' => 'text', 'label' => 'Label', 'maxLength' => 40],
                        'title' => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 60],
                        'text'  => ['kind' => 'textarea', 'label' => 'Text', 'maxLength' => 240],
                    ],
                ],
                'stats' => [
                    'kind' => 'list', 'label' => 'Stats', 'maxItems' => 6,
                    'of' => ['kind' => 'group', 'fields' => [
                        'value' => ['kind' => 'text', 'label' => 'Value', 'maxLength' => 12],
                        'label' => ['kind' => 'text', 'label' => 'Label', 'maxLength' => 40],
                    ]],
                ],
                'partnerTypes' => [
                    'kind' => 'list', 'label' => 'Partner types', 'maxItems' => 8,
                    'of' => ['kind' => 'group', 'fields' => [
                        'title' => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 60],
                        'copy'  => ['kind' => 'textarea', 'label' => 'Description', 'maxLength' => 300],
                        'tag'   => ['kind' => 'text', 'label' => 'Tag', 'maxLength' => 30],
                    ]],
                ],
                'strengths' => [
                    'kind' => 'list', 'label' => 'Strengths', 'maxItems' => 10,
                    'of' => ['kind' => 'text', 'maxLength' => 200],
                ],
                'process' => [
                    'kind' => 'list', 'label' => 'Process steps', 'maxItems' => 10,
                    'of' => ['kind' => 'text', 'maxLength' => 200],
                ],
                'inquiry' => [
                    'kind' => 'group', 'label' => 'Closing call to action',
                    'fields' => [
                        'label'    => ['kind' => 'text', 'label' => 'Label', 'maxLength' => 40],
                        'title'    => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 80],
                        'text'     => ['kind' => 'textarea', 'label' => 'Text', 'maxLength' => 300],
                        'ctaLabel' => ['kind' => 'text', 'label' => 'Button label', 'maxLength' => 40],
                        'ctaTo'    => ['kind' => 'url', 'label' => 'Button link'],
                    ],
                ],
            ],
        ],

        // ---------------------------------------------------------- community
        // Note: topLinks / sideLinks are navigation, not content — they stay in
        // code so the page's link structure can't be broken from the dashboard.
        'community' => [
            'label'  => 'Community page',
            'fields' => [
                'backgroundImage' => ['kind' => 'image', 'label' => 'Background image', 'upload' => 'site'],
                'spotlight' => [
                    'kind' => 'group', 'label' => 'Spotlight',
                    'fields' => [
                        'leadLabel'      => ['kind' => 'text', 'label' => 'Lead label', 'maxLength' => 40],
                        'metric'         => ['kind' => 'text', 'label' => 'Metric', 'maxLength' => 20],
                        'metricValue'    => ['kind' => 'text', 'label' => 'Metric value', 'maxLength' => 10],
                        'metricCaption'  => ['kind' => 'textarea', 'label' => 'Metric caption', 'maxLength' => 240],
                        'title'          => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 80],
                        'subtitle'       => ['kind' => 'text', 'label' => 'Subtitle', 'maxLength' => 60],
                        'badge'          => ['kind' => 'text', 'label' => 'Badge', 'maxLength' => 30],
                        'supportingText' => ['kind' => 'textarea', 'label' => 'Supporting text', 'maxLength' => 400],
                    ],
                ],
                'highlights' => [
                    'kind' => 'list', 'label' => 'Highlights', 'maxItems' => 10,
                    'of' => ['kind' => 'text', 'maxLength' => 160],
                ],
            ],
        ],

        // -------------------------------------------------------------- music
        'music' => [
            'label' => 'Music',
            'blurb' => 'The catalogue and the streaming links. Audio stays on its own '
                     . 'host — paste the file URL rather than uploading it here.',
            'fields' => [
                'platformLinks' => [
                    'kind' => 'group', 'label' => 'Streaming platforms',
                    'fields' => [
                        'spotify'      => ['kind' => 'url', 'label' => 'Spotify'],
                        'youtubeMusic' => ['kind' => 'url', 'label' => 'YouTube Music'],
                        'appleMusic'   => ['kind' => 'url', 'label' => 'Apple Music'],
                        'soundcloud'   => ['kind' => 'url', 'label' => 'SoundCloud'],
                    ],
                ],
                'catalog' => [
                    'kind' => 'list', 'label' => 'Tracks', 'maxItems' => 100,
                    'of' => ['kind' => 'group', 'fields' => [
                        'id'        => ['kind' => 'text', 'label' => 'ID', 'maxLength' => 60,
                                        'help' => 'Stable key — changing it breaks links that point at this track.'],
                        'title'     => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 120],
                        'artist'    => ['kind' => 'text', 'label' => 'Artist', 'maxLength' => 80],
                        'category'  => ['kind' => 'text', 'label' => 'Category', 'maxLength' => 40],
                        'type'      => ['kind' => 'text', 'label' => 'Type', 'maxLength' => 40],
                        'year'      => ['kind' => 'text', 'label' => 'Year', 'maxLength' => 8],
                        'duration'  => ['kind' => 'text', 'label' => 'Duration', 'maxLength' => 10],
                        'mood'      => ['kind' => 'text', 'label' => 'Mood', 'maxLength' => 60],
                        'art'       => ['kind' => 'image', 'label' => 'Cover art', 'upload' => 'site'],
                        'thumbnail' => ['kind' => 'image', 'label' => 'Thumbnail', 'upload' => 'site'],
                        'audioSrc'  => ['kind' => 'url', 'label' => 'Audio file URL'],
                        'previewStart'    => ['kind' => 'number', 'label' => 'Preview start (s)'],
                        'previewDuration' => ['kind' => 'number', 'label' => 'Preview length (s)'],
                        'summary'   => ['kind' => 'textarea', 'label' => 'Summary', 'maxLength' => 600],
                    ]],
                ],
                'featuredReleases' => [
                    'kind' => 'list', 'label' => 'Featured releases', 'maxItems' => 12,
                    'help' => 'The release cards at the top of the Music page.',
                    'of' => ['kind' => 'group', 'fields' => [
                        'id'        => ['kind' => 'text', 'label' => 'ID', 'maxLength' => 60],
                        'trackId'   => ['kind' => 'text', 'label' => 'Track ID', 'maxLength' => 60,
                                        'help' => 'Optional — links this card to a track in the catalogue.'],
                        'title'     => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 120],
                        'type'      => ['kind' => 'text', 'label' => 'Type', 'maxLength' => 40],
                        'year'      => ['kind' => 'text', 'label' => 'Year', 'maxLength' => 8],
                        'image'     => ['kind' => 'image', 'label' => 'Image', 'upload' => 'site'],
                        'thumbnail' => ['kind' => 'image', 'label' => 'Thumbnail', 'upload' => 'site'],
                        'audioSrc'  => ['kind' => 'url', 'label' => 'Audio URL', 'nullable' => true],
                        'summary'   => ['kind' => 'textarea', 'label' => 'Summary', 'maxLength' => 600],
                    ]],
                ],
                'recentRecordIds' => [
                    'kind' => 'list', 'label' => 'Recent records', 'maxItems' => 12,
                    'help' => 'Track IDs, in order, for the Recent Records strip.',
                    'of' => ['kind' => 'text', 'maxLength' => 60],
                ],
                'homePromoTrackIds' => [
                    'kind' => 'list', 'label' => 'Home page tracks', 'maxItems' => 12,
                    'help' => 'Track IDs, in order, promoted on the home page.',
                    'of' => ['kind' => 'text', 'maxLength' => 60],
                ],
            ],
        ],

        // -------------------------------------------------------------- pages
        // Copy that used to be hardcoded in the JSX. Headings are split into a
        // plain part and an emphasised part because that's how they're rendered
        // (<h1>Founded <em>Music.</em></h1>) — and they're tightly capped, since
        // these wrap at breakpoints the design was tuned around.
        'pages' => [
            'label' => 'Page copy',
            'blurb' => 'Headings and intro copy across the home and about pages. '
                     . 'Lengths are capped so the layouts keep their shape.',
            'fields' => [
                'homeHero' => [
                    'kind' => 'group', 'label' => 'Home hero',
                    'fields' => [
                        'eyebrow'   => ['kind' => 'text', 'label' => 'Eyebrow', 'maxLength' => 40],
                        'title'     => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 30],
                        'titleEm'   => ['kind' => 'text', 'label' => 'Title (emphasised)', 'maxLength' => 30],
                        'lead'      => ['kind' => 'textarea', 'label' => 'Lead', 'maxLength' => 320],
                        'ctaPrimary'   => ['kind' => 'text', 'label' => 'Primary button', 'maxLength' => 40],
                        'ctaSecondary' => ['kind' => 'text', 'label' => 'Secondary button', 'maxLength' => 40],
                    ],
                ],
                'aboutBand' => [
                    'kind' => 'group', 'label' => 'About band (home + about)',
                    'fields' => [
                        'eyebrow' => ['kind' => 'text', 'label' => 'Eyebrow', 'maxLength' => 40],
                        'title'   => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 30],
                        'titleEm' => ['kind' => 'text', 'label' => 'Title (emphasised)', 'maxLength' => 30],
                        'lead'    => ['kind' => 'textarea', 'label' => 'Lead', 'maxLength' => 400],
                        'ctaLabel' => ['kind' => 'text', 'label' => 'Button label', 'maxLength' => 40],
                        'facts' => [
                            'kind' => 'list', 'label' => 'Facts', 'maxItems' => 6,
                            'of' => ['kind' => 'group', 'fields' => [
                                'label' => ['kind' => 'text', 'label' => 'Label', 'maxLength' => 30],
                                'value' => ['kind' => 'text', 'label' => 'Value', 'maxLength' => 40],
                            ]],
                        ],
                    ],
                ],
                'aboutStory' => [
                    'kind' => 'group', 'label' => 'About story',
                    'fields' => [
                        'eyebrow'    => ['kind' => 'text', 'label' => 'Eyebrow', 'maxLength' => 40],
                        'title'      => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 70],
                        'paragraphs' => [
                            'kind' => 'list', 'label' => 'Paragraphs', 'maxItems' => 6,
                            'of' => ['kind' => 'textarea', 'maxLength' => 800],
                        ],
                        'pointsEyebrow' => ['kind' => 'text', 'label' => 'Points eyebrow', 'maxLength' => 40],
                        'points' => [
                            'kind' => 'list', 'label' => 'Points', 'maxItems' => 8,
                            'of' => ['kind' => 'text', 'maxLength' => 200],
                        ],
                    ],
                ],
                'roster' => [
                    'kind' => 'group', 'label' => 'Roster heading',
                    'fields' => [
                        'eyebrow' => ['kind' => 'text', 'label' => 'Eyebrow', 'maxLength' => 40],
                        'title'   => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 60],
                        'note'    => ['kind' => 'text', 'label' => 'Note', 'maxLength' => 120,
                                      'help' => 'The member count is added automatically before this.'],
                    ],
                ],
                'footer' => [
                    'kind' => 'group', 'label' => 'Footer',
                    'fields' => [
                        'mission' => ['kind' => 'textarea', 'label' => 'Mission statement', 'maxLength' => 500],
                    ],
                ],
            ],
        ],

        // ------------------------------------------------------------ gallery
        // Boards and categories used to be derived from two shared arrays via
        // .slice(), which can't be edited from a dashboard. Each one now owns an
        // explicit image list. The old `size` ("N photos in set") field is gone —
        // nothing ever rendered it.
        'gallery' => [
            'label' => 'Gallery',
            'blurb' => 'Boards, categories, and the marquee on the home page.',
            'fields' => [
                'boards' => [
                    'kind' => 'list', 'label' => 'Boards', 'maxItems' => 12,
                    'of' => ['kind' => 'group', 'fields' => [
                        'title'  => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 60],
                        'images' => [
                            'kind' => 'list', 'label' => 'Images', 'maxItems' => 60,
                            'of' => ['kind' => 'image', 'upload' => 'gallery'],
                        ],
                    ]],
                ],
                'categories' => [
                    'kind' => 'list', 'label' => 'Categories', 'maxItems' => 12,
                    'of' => ['kind' => 'group', 'fields' => [
                        'id'           => ['kind' => 'text', 'label' => 'ID', 'maxLength' => 40,
                                           'help' => 'Lowercase key used to select this category.'],
                        'label'        => ['kind' => 'text', 'label' => 'Label', 'maxLength' => 40],
                        'image'        => ['kind' => 'image', 'label' => 'Tile image', 'upload' => 'gallery'],
                        'hero'         => ['kind' => 'image', 'label' => 'Hero image', 'upload' => 'gallery'],
                        'featureTitle' => ['kind' => 'text', 'label' => 'Feature title', 'maxLength' => 80],
                        'featureText'  => ['kind' => 'textarea', 'label' => 'Feature text', 'maxLength' => 400],
                        'images' => [
                            'kind' => 'list', 'label' => 'Images', 'maxItems' => 120,
                            'of' => ['kind' => 'image', 'upload' => 'gallery'],
                        ],
                    ]],
                ],
                'feature' => [
                    'kind' => 'group', 'label' => 'Feature card',
                    'fields' => [
                        'title'    => ['kind' => 'text', 'label' => 'Title', 'maxLength' => 80],
                        'category' => ['kind' => 'text', 'label' => 'Category', 'maxLength' => 40],
                        'image'    => ['kind' => 'image', 'label' => 'Image', 'upload' => 'gallery'],
                        'artist'   => ['kind' => 'text', 'label' => 'Credit', 'maxLength' => 80],
                        'location' => ['kind' => 'text', 'label' => 'Location', 'maxLength' => 60],
                        'note'     => ['kind' => 'textarea', 'label' => 'Note', 'maxLength' => 500],
                    ],
                ],
                'marqueeImages' => [
                    'kind' => 'list', 'label' => 'Home marquee images', 'maxItems' => 20,
                    'help' => 'The scrolling strip on the home page.',
                    'of' => ['kind' => 'image', 'upload' => 'gallery'],
                ],
            ],
        ],

    ];
}

function content_section(string $name): ?array
{
    return content_sections()[$name] ?? null;
}

// ---------------------------------------------------------------------------
// Read-time enrichment. content.php calls content_enrich_<section>() when it
// exists (see the note there). These add DERIVED fields only — anything an
// admin should type belongs in the schema above.
// ---------------------------------------------------------------------------

// The Join page shows the rehearsal time, but it's stored once under Contact so
// the two can never disagree.
function content_enrich_join(array $data): array
{
    $contact = store_read('content_contact', []);
    $rehearsal = '';
    foreach ((array) ($contact['items'] ?? []) as $item) {
        if (($item['label'] ?? '') === 'Rehearsals') {
            $rehearsal = (string) ($item['value'] ?? '');
            break;
        }
    }
    $data['rehearsal'] = $rehearsal;
    return $data;
}

// Every track offers the same streaming platforms, so the links live once at
// section level and are stamped onto each track on the way out.
function content_enrich_music(array $data): array
{
    $links = $data['platformLinks'] ?? [];
    $data['catalog'] = array_map(
        function (array $track) use ($links) {
            $track['streamingLinks'] = $links;
            return $track;
        },
        (array) ($data['catalog'] ?? []),
    );
    return $data;
}
