var DreamAI = {
    init: function () {
        DreamAI.loader.show(), DreamAI.API.callendpoint("user-prompts", {}, function (e) {
            prompts = e.prompts,
                DreamAI.options.is_creator_style_allowed = e.is_creator_style_allowed || 'No',
                DreamAI.options.debug_mode = e.debug_mode || false,
                DreamAI.options.create(prompts),
                $("#comment_lenght").val(e.comment_lenth),
                $("#personality").val(e.personality || ''),
                // trigger input to update char count immediately
                $("#personality").trigger('input'),
                DreamAI.creators.render(e.comment_creators || []),
                DreamAI.creators.bindAll(),
                $("#prompts_wrap").show(),
                DreamAI.loader.hide()
        }),
            // Character counter
            $('#personality').on('input', function () {
                let len = $(this).val().length;
                $(this).siblings('.char-hint').text(len + ' / 200 characters');
            }),
            $("#promots").submit(function () {
                var e = $(this),
                    a = e.find(".aud_submit"),
                    s = a.val(),
                    t = DreamAI.input.serializeToObject(e.serialize());
                return a.val("Please Wait...").attr("disabled", "disabled"), DreamAI.API.callendpoint("save-prompts", t, function (e) {
                    e.error ? DreamAI.msg.error(e.msg) : DreamAI.msg.success(e.msg), a.val(s).removeAttr("disabled")
                }), !1
            });

        $("#reset").on("click", function () {
            if (confirm("Are you sure ?")) {
                DreamAI.API.callendpoint("reset_prompts", {}, function (e) {
                    e.error ? DreamAI.msg.error(e.msg) : (DreamAI.msg.success(e.msg), document.location.reload())
                });
            }
        });

        // Tab switching logic
        (function () {
            let activeTab = localStorage.getItem('active_superlio_tab') || 'tab-personalisation';
            $('.tab-btn').removeClass('active');
            $('.tab-pane').hide();
            $('.tab-btn[data-tab="' + activeTab + '"]').addClass('active');
            $('#' + activeTab).show();

            if (activeTab === 'tab-creators') {
                $('.button_wrap').hide();
            } else {
                $('.button_wrap').show();
            }

            $('.tab-btn').on('click', function () {
                $('.tab-btn').removeClass('active');
                $(this).addClass('active');

                $('.tab-pane').hide();
                let tabId = $(this).data('tab');
                $('#' + tabId).show();
                localStorage.setItem('active_superlio_tab', tabId);

                if (tabId === 'tab-creators') {
                    $('.button_wrap').hide();
                } else {
                    $('.button_wrap').show();
                }
            });
        })();
    },
    API: {
        callendpoint: function (e, a, s) {
            chrome.runtime.sendMessage({
                action: "API",
                endpoint: e,
                data: a
            }, function (e) {
                s(e)
            })
        }
    },
    creators: {
        MAX: 6,
        data: [],

        render: function (creators) {
            // Do not strip out nulls — preserve backend array indices so deletion works!
            this.data = creators;
            this.rebuildUI();
        },

        rebuildUI: function () {
            let $wrap = $('#creator_slots').empty();
            let count = 0;

            if (DreamAI.options.is_creator_style_allowed !== 'Yes') {
                $wrap.html('<div class="upgrade-card"><div class="upgrade-icon">🔒</div><h3>Creator Style Locked</h3><p>Engaging in the style of top creators is not included in your current plan.</p><a href="https://app.superlio.ai/pricing" target="_blank" class="upgrade-cta">Upgrade to unlock</a></div>');
                return;
            }

            for (let i = 0; i < this.data.length; i++) {
                if (this.data[i]) {
                    $wrap.append(this.buildSlot(i, this.data[i]));
                    count++;
                }
            }

            if (count < this.MAX) {
                $wrap.append(this.buildAddNewSlot(this.MAX - count));
            }
        },

        buildSlot: function (index, creator) {
            let avatarUrl = creator.avatar || '';
            let proxiedSrc = avatarUrl && avatarUrl.startsWith('http')
                ? 'https://apidev.superlio.ai/content/proxy-image?url=' + encodeURIComponent(avatarUrl)
                : '';

            // Use a placeholder description if none exists
            let desc = creator.description || "Informative and engaging, blending personal anecdotes with actionable insights.";

            // Strip redundant prefixes to show more useful content
            desc = desc.replace(/^The creator\'?s?\s+(engagement\s+)?style\s+(uses|is|features|employs|relies on|leverages|combines|blends|focuses on)\s+/i, '');
            desc = desc.replace(/^The creator\s+(uses|employs|relies on)\s+/i, '');
            desc = desc.replace(/^Uses\s+/i, '');
            // Capitalize first letter after stripping
            if (desc.length > 0) {
                desc = desc.charAt(0).toUpperCase() + desc.slice(1);
            }

            let isActive = creator.active !== false && creator.active !== 0 && creator.active !== '0';

            // Build the card HTML
            return `<div class="creator-slot ${isActive ? 'active' : ''}" data-index="${index}" data-id="${creator.id}" style="margin-bottom: 5px;">
                <button class="dash-remove-creator remove-btn" data-index="${index}" title="Remove Creator" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; font-size: 16px; cursor: pointer; color: #9ca3af;">✕</button>
                <div class="creator-meta">
                    ${proxiedSrc ? `<img src="${proxiedSrc}" class="creator-avatar-img" />` : ''}
                    <span class="creator-name">${creator.name}</span>
                </div>
                <div class="creator-description">${desc}</div>
                
                <div class="creator-actions-row">
                    <div class="creator-toggle-wrap">
                        <label class="switch">
                            <input type="checkbox" ${isActive ? 'checked' : ''} class="creator-active-toggle" data-index="${index}">
                            <span class="slider"></span>
                        </label>
                        <span>Active</span>
                    </div>
                    
                    ${DreamAI.options.debug_mode ? `<div class="view-comments-box view-comments-btn" data-index="${index}">
                        View Comments
                    </div>` : ''}
                    
                    <button class="refresh-creator-btn" data-index="${index}" title="Refresh Comments">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                </div>
                <span class="fetched-date dev-only" style="display:none;">${creator.fetched_at}</span>
            </div>`;
        },

        buildAddNewSlot: function (remaining) {
            return `<div class="creator-slot add-new" id="add_new_slot">
                <div class="add-icon">+</div>
                <div class="add-text">Import a style</div>
                <div class="slots-remaining">${remaining} slots remaining</div>
            </div>`;
        },

        fetch: function (url, $slot, actionParam = 'add', indexParam = null, avatarSrc = '', name = '') {
            let loadingHtml = '';

            if (actionParam === 'refresh' && avatarSrc) {
                // Keep avatar visible, show spinner below
                loadingHtml = `
                    <div class="creator-slot fetching-slot active" style="justify-content:center; position:relative;">
                        <div class="creator-meta">
                            <img src="${avatarSrc}" class="creator-avatar-img" alt="${name}" />
                            <span class="creator-name">${name}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
                            <div class="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #614bfb; border-radius: 50%; width: 18px; height: 18px; animation: spin 1s linear infinite;"></div>
                            <span style="font-size:13px; font-weight:500; color:#614bfb;">Analysing Creator...</span>
                        </div>
                    </div>`;
            } else {
                loadingHtml = `<div class="creator-slot fetching-slot" style="justify-content:center;">
                    <span style="font-size:14px; font-weight:500; color:#614bfb; display:flex; align-items:center; gap:8px;">
                        <span class="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #614bfb; border-radius: 50%; width: 18px; height: 18px; animation: spin 1s linear infinite; display:inline-block;"></span>
                        Analysing Creator...
                    </span>
                </div>`;
            }

            $slot.replaceWith(loadingHtml);

            chrome.runtime.sendMessage({
                action: 'FETCH_CREATOR_COMMENTS',
                profileUrl: url
            }, function (response) {
                if (response && response.error) {
                    DreamAI.msg.error(response.error);
                    DreamAI.creators.rebuildUI(); // restore add button
                } else if (response) {
                    let indexToSave = (actionParam === 'refresh' && indexParam !== null) ? indexParam : DreamAI.creators.data.length; // Append or Refresh mode
                    DreamAI.API.callendpoint('save-creator', {
                        action: actionParam,
                        index: indexToSave,
                        creator: JSON.stringify(response)
                    }, function (res) {
                        let creators = res.creators || res.data?.creators;
                        if (!res.error) {
                            // Use the backend's canonical creators array to rebuild UI
                            if (creators) {
                                DreamAI.creators.render(creators);
                            } else {
                                // Fallback if backend doesn't return creators
                                response.comment_count = res.filtered_count || res.data?.filtered_count || response.comments?.length || 0;
                                DreamAI.creators.data[indexToSave] = response;
                                DreamAI.creators.rebuildUI();
                            }
                            DreamAI.msg.success(actionParam === 'refresh' ? "Writing style refreshed successfully" : "Writing style imported successfully");
                        } else {
                            if (res.kept_previous) {
                                // Refresh failed minimum threshold but kept previous data
                                DreamAI.msg.error(res.msg || 'Not enough unique comments. Previous style kept.');
                                if (creators) DreamAI.creators.render(creators);
                            } else {
                                DreamAI.msg.error(res.msg || 'Save failed');
                            }
                            DreamAI.creators.rebuildUI();
                        }
                    });
                } else {
                    DreamAI.msg.error("No response from voyager");
                    DreamAI.creators.rebuildUI();
                }
            });
        },

        remove: function (index) {
            DreamAI.API.callendpoint('save-creator', {
                action: 'remove',
                index: index
            }, function (res) {
                let creators = res.creators || res.data?.creators;
                if (!res.error) {
                    // Use the backend's canonical creators array to rebuild UI
                    if (creators) {
                        DreamAI.creators.render(creators);
                    } else {
                        DreamAI.creators.data[index] = null;
                        DreamAI.creators.rebuildUI();
                    }
                }
            });
        },

        bindAll: function () {
            let $wrap = $('#creator_slots');
            let $modal = $('#import_modal_overlay');
            let $modalInput = $('#modal_creator_url');
            let $modalConfirm = $('#confirm_import_btn');

            // Clean up old events to prevent multiples
            $wrap.off('click');
            $('#close_import_modal, #cancel_import_btn').off('click');
            $modalConfirm.off('click');

            // Open Modal
            $wrap.on('click', '#add_new_slot', function () {
                $modalInput.val('');
                $modalConfirm.text('Import Style').removeAttr('disabled');
                $modal.css('display', 'flex');
                setTimeout(() => $modalInput.focus(), 100);
            });

            // Close Modal
            $('#close_import_modal, #cancel_import_btn').on('click', function () {
                $modal.hide();
            });

            // Confirm Import
            $modalConfirm.on('click', function () {
                let url = $modalInput.val().trim();
                if (url) {
                    $(this).text('Fetching...').attr('disabled', true);
                    let $placeholder = $('#add_new_slot');
                    DreamAI.creators.fetch(url, $placeholder);
                    $modal.hide(); // Hide modal immediately while background fetch happens
                }
            });

            // Remove Button
            $wrap.on('click', '.remove-btn', function (e) {
                e.preventDefault();
                let index = $(this).closest('.creator-slot').data('index');
                if (index !== undefined) {
                    if (confirm("Remove this writing style?")) {
                        DreamAI.creators.remove(index);
                    }
                }
            });

            // Toggle Active Switch
            $wrap.on('change', '.creator-active-toggle', function () {
                let index = $(this).closest('.creator-slot').data('index');
                let isActive = $(this).is(':checked');
                let $slot = $(this).closest('.creator-slot');

                if (isActive) {
                    $slot.addClass('active');
                } else {
                    $slot.removeClass('active');
                }

                if (index !== undefined) {
                    DreamAI.API.callendpoint('save-creator', {
                        action: 'toggle_active',
                        index: index,
                        active: isActive
                    }, function (res) {
                        if (res.error) {
                            DreamAI.msg.error("Failed to update status");
                            DreamAI.creators.rebuildUI(); // Revert toggle visually
                        }
                    });
                }
            });

            // Refresh Comments Button
            $wrap.on('click', '.refresh-creator-btn', function (e) {
                e.preventDefault();
                let index = $(this).closest('.creator-slot').data('index');
                let creator = DreamAI.creators.data[index];

                if (creator && creator.fetched_at) {
                    let fetchedTime = new Date(creator.fetched_at).getTime();
                    let currentTime = Date.now();
                    let hoursDiff = (currentTime - fetchedTime) / (1000 * 60 * 60);

                    if (!DreamAI.options.debug_mode && hoursDiff < 72) {
                        DreamAI.msg.warning("You can only refresh a creator's style once every 3 days.");
                        return;
                    }
                }

                let fetchUrl = creator ? (creator.profile_url || creator.profileUrl || creator.url) : null;

                if (creator && fetchUrl) {
                    let $btn = $(this);
                    $btn.addClass('spinning');

                    let $slot = $btn.closest('.creator-slot');
                    let avatarSrc = $slot.find('.creator-avatar-img').attr('src') || '';
                    let name = $slot.find('.creator-name').text() || 'Creator';

                    // We don't replace here because fetch() will do it with the loading spinner
                    DreamAI.creators.fetch(fetchUrl, $slot, 'refresh', index, avatarSrc, name);
                } else {
                    DreamAI.msg.error("Cannot refresh: Profile URL missing");
                }
            });

            // Enter key support for modal input
            $modalInput.on('keypress', function (e) {
                if (e.which == 13) {
                    e.preventDefault();
                    $modalConfirm.click();
                }
            });

            // Listen for progress events from background to show skeleton while fetching
            chrome.runtime.onMessage.addListener(function (message) {
                if (message.action === "CREATOR_FETCH_PROGRESS") {
                    let $fetchingSlot = $('.fetching-slot');
                    if ($fetchingSlot.length) {
                        // Check if avatar already exists (refresh mode) — preserve it
                        let existingAvatar = $fetchingSlot.find('.creator-avatar-img');
                        if (existingAvatar.length) {
                            // Refresh mode: keep avatar + name, just update the status text below
                            $fetchingSlot.find('.spinner').parent().find('span').text('Analysing Creator...');
                        } else {
                            // New import mode: show spinner + purple text
                            $fetchingSlot.html(`
                                <span style="font-size:14px; font-weight:500; color:#614bfb; display:flex; align-items:center; gap:8px;">
                                    <span class="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #614bfb; border-radius: 50%; width: 18px; height: 18px; animation: spin 1s linear infinite; display:inline-block;"></span>
                                    Analysing Creator...
                                </span>
                            `).css('justify-content', 'center');
                        }
                    }
                }
            });

            // View Comments Modal
            let $viewModal = $('#view_comments_modal_overlay');
            let $viewModalList = $('#comments_list');

            $wrap.on('click', '.view-comments-btn', function (e) {
                e.preventDefault();
                let index = $(this).closest('.creator-slot').data('index');
                let creator = DreamAI.creators.data[index];

                if (creator) {
                    let rawComments = creator.raw_comments || [];
                    let filteredComments = creator.comments || [];
                    $('#view_comments_title').text(creator.name + "'s Comments (" + rawComments.length + " fetched, " + filteredComments.length + " filtered)");
                    $viewModalList.empty();

                    let commentsToShow = filteredComments.length > 0 ? filteredComments : rawComments;
                    if (commentsToShow.length === 0) {
                        $viewModalList.append('<div class="comment-item">No comments available.</div>');
                    } else {
                        commentsToShow.forEach(function (comment, idx) {
                            let safeComment = $('<div>').text(comment).html();
                            let badgeHtml = '<div class="comment-badge">#' + (idx + 1) + '</div>';
                            $viewModalList.append('<div class="comment-item">' + badgeHtml + safeComment + '</div>');
                        });
                    }

                    $viewModal.css('display', 'flex');
                }
            });

            $('#close_view_comments_modal, #dismiss_view_comments_btn').on('click', function () {
                $viewModal.hide();
            });
        }
    },
    options: {
        create: function (e) {
            let a = 1;
            let $container = $("#prompts");
            $container.empty();

            for (let s in e) {
                let prompt = e[s];
                $container.append(`
                    <div class="custom-prompt-item">
                        <div class="field-group">
                            <input type="text" id="prompt_label_${a}" name="prompt_label_${a}" value="${prompt.label}" class="input_box" placeholder="e.g. Sales Pitch">
                        </div>
                        <div class="field-group">
                            <textarea id="prompt_desc_${a}" name="prompt_desc_${a}" class="input_box" placeholder="e.g. Rewrite this to sound like a compelling sales pitch...">${prompt.description}</textarea>
                        </div>
                    </div>
                `);
                a++;
            }
            // Add empty slots if less than 3
            if (a < 3) {
                for (let t = a; t <= 2; t++) {
                    $container.append(`
                        <div class="custom-prompt-item">
                            <div class="field-group">
                                <input type="text" id="prompt_label_${t}" name="prompt_label_${t}" class="input_box" placeholder="e.g. Sales Pitch">
                            </div>
                            <div class="field-group">
                                <textarea id="prompt_desc_${t}" name="prompt_desc_${t}" class="input_box" placeholder="e.g. Rewrite this to sound like a compelling sales pitch..."></textarea>
                            </div>
                        </div>
                    `);
                }
            }
        }
    },
    input: {
        serializeToObject: function (e) {
            var a = e.split("&"),
                s = {};
            for (var t in a) {
                var r = a[t].split("="),
                    n = r[0].replace("%5B%5D", ""),
                    o = decodeURIComponent(r[1].replace(/\+/g, " "));
                s[n] ? s[n].constructor === Array ? s[n].push(o) : s[n] = [s[n], o] : -1 == r[0].indexOf("%5B%5D") ? s[n] = o : s[n] = [o]
            }
            return s
        }
    },
    msg: {
        success: function (e) {
            this.showMessage("dreamai_success", e)
        },
        error: function (e) {
            this.showMessage("dreamai_error", e)
        },
        warning: function (e) {
            this.showMessage("dreamai_warning", e)
        },
        showMessage: function (e, a) {
            var s = $('<div class="dreamai_message ' + e + '"></div>').text(a);
            $("body").append(s), width = s.outerWidth(), height = s.outerHeight(), marginLeft = width / 2, marginTop = height / 2, s.css({
                marginLeft: -marginLeft,
                marginTop: -marginTop
            }), s.fadeIn("slow"), setTimeout(function () {
                s.fadeOut(function () {
                    s.remove()
                })
            }, 2e3)
        }
    },
    loader: {
        show: function () {
            $("body").append('<div class="dreamai-loader"></div>')
        },
        hide: function () {
            $(".dreamai-loader").remove()
        }
    }
};
DreamAI.init();