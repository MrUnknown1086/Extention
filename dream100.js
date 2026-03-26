var DreamAI = {
    debug_mode: !0,
    base_url: "https://dev.superlio.ai/",
    member: {},
    ready_called: !1,
    data: {
        selected_urn: !1,
        text_interval: !1
    },
    last_url: !1,
    domains: ["linkedin"],
    options: {},
    // extsettings : {
    //     banners: ".scaffold-layout__main > .artdeco-dropdown",
    //     comment: ".comments-comment-texteditor",
    //     icon: ".display-flex, .display-flex, .display-flex:first-child",
    //     profile: ".pvs-profile-actions",
    //     sidebar: ".scaffold-layout__sidebar"
    // },
    extsettings: {},
    ready: function (e) {
        DreamAI.API.callendpoint("settings", {}, function (res) {
            if (!DreamAI.extsettings.error) {
                DreamAI.extsettings = {
                    banners: res.banners,
                    comment: res.comment,
                    icon: res.icon,
                    profile: res.profile,
                    sidebar: res.sidebar,
                    articleContent: res.articleContent,
                    commentContent: res.commentContent,
                };
            }
            DreamAI.settings.get_options(function (t) {
                DreamAI.options = t, DreamAI.API.callendpoint("prompts", {}, function (t) {
                    DreamAI.options.tones = t.prompts, DreamAI.options.efficiency = t.efficiency, DreamAI.options.banners = t.banners, DreamAI.options.plan_type = t.plan_type, DreamAI.options.user = t.user, DreamAI.options.sbtns = t.side_btns, DreamAI.options.is_creator_style_allowed = t.is_creator_style_allowed || 'No', DreamAI.options.comment_creators = t.comment_creators || [], DreamAI.options.creator_count = t.creator_count || (t.comment_creators ? t.comment_creators.length : 0), DreamAI.contextMenu.create(function () {
                        e()
                    })
                });
            });
        })
    },
    contextMenu: {
        menu: !1,
        create: function (e) {
            let t = DreamAI.options.tones,
                a = "";

            that = this;
            let efficiency = DreamAI.options.efficiency;
            let classname = "on";
            let title = "Learning Mode enabled.";
            if ("free" == DreamAI.options.plan_type) {
                classname = "";
                title = "Warning: Activating this can Blow your Mind\uD83E\uDD2F ";
            }

            a += '<div class="dreamai-cmenu" id="dreamai-cmenu">';

            // Info button for re-triggering tour (positioned absolute, no layout impact)
            a += '<span class="tour-info-btn" title="Take a tour of Superlio" style="position: absolute; right: 12px; top: 12px; cursor: pointer; opacity: 0.6; font-size: 14px; z-index: 10; line-height: 1;">ⓘ</span>';

            a += '<div class="efficiency  ' + classname + '" title="' + title + '">';
            a += '\t<div class="efficiency_left">';
            a += '\t\tLearning Mode <div class="toggle ' + classname + '" id="enable_humanmode"  ><div class="slide"></div></div>';
            a += '\t</div>';
            a += "</div>";
            a += "<ul>";
            a += '<li class="section-heading"><span>Pretrained</span></li>';

            let hasRenderedCustomHeading = false;
            for (let n in t) {
                let isCustom = n.includes('custom') || n.includes('prompt') || (t[n].label && t[n].label.toLowerCase().includes('custom'));

                if (isCustom && !hasRenderedCustomHeading) {
                    a += '<li class="section-heading"><span>Custom Style</span></li>';
                    hasRenderedCustomHeading = true;
                }

                let icon = t[n].icon ? t[n].icon : "";
                if (isCustom) icon = "✍️";
                a += '<li class="tones" data-tone="' + n + '">' + icon + " " + t[n].label;

                if (!isCustom) {
                    if ("free" != DreamAI.options.plan_type) {
                        let progress = (efficiency && efficiency[n] && efficiency[n].progress) ? efficiency[n].progress : 0;
                        a += '<span class="prog_lbl">' + progress + '%</span><span class="efficiency_prog"><span class="progress" style="width:' + progress + '%"></span></span>';
                    } else {
                        a += '<span class="prog_lbl lock" title=""></span><span class="efficiency_prog"></span>';
                    }
                }

                a += "</li>";
            }
            let hasCreators = DreamAI.options.creator_count > 0;
            a += '<li class="section-heading" style="margin-top: 4px;"><span>Creator Style</span></li>';
            // Build creator avatar thumbnails
            let avatarHtml = '';
            if (hasCreators && DreamAI.options.comment_creators) {
                let creators = DreamAI.options.comment_creators.filter(c => c && c.avatar);
                if (creators.length > 0) {
                    // Sort active to the front
                    creators.sort((a, b) => {
                        let aActive = (a.active !== false && a.active !== '0' && a.active !== 0) ? 1 : 0;
                        let bActive = (b.active !== false && b.active !== '0' && b.active !== 0) ? 1 : 0;
                        return bActive - aActive;
                    });

                    avatarHtml = '<span style="display:inline-flex; margin-left:auto; vertical-align:middle; margin-right: 4px;">';
                    creators.forEach((c, idx) => {
                        let isActive = (c.active !== false && c.active !== '0' && c.active !== 0);
                        let filterStyle = isActive ? '' : 'filter: grayscale(100%); opacity: 0.5;';
                        let zIndex = 10 - idx;
                        avatarHtml += `<img src="${c.avatar}" style="width:20px;height:20px;border-radius:50%;border:1.5px solid #fff;margin-left:-6px;object-fit:cover; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position:relative; z-index:${zIndex}; ${filterStyle}" title="${c.name || 'Creator'}" />`;
                    });
                    avatarHtml += '</span>';
                }
            }

            let isCreatorStyleLocked = (DreamAI.options.is_creator_style_allowed && DreamAI.options.is_creator_style_allowed !== 'Yes');

            if (isCreatorStyleLocked) {
                a += `<li class="creator-style-btn disabled locked" style="position: relative; padding: 6px 14px; margin-top: 2px; border-radius: 8px; font-weight: 500; display:flex; align-items:center; background: #f9fafb; border: 1px solid #f3f4f6;" title="Upgrade your plan to unlock Creator Style"><span style="color: #4b5563;">⭐ <span style="margin-left:4px;">Creator Style</span></span><span style="position:absolute; right: 54px; font-size: 14px; opacity: 1;">🔒</span></li>`;
            } else {
                a += `<li class="creator-style-btn ${hasCreators ? '' : 'disabled'}" style="${hasCreators ? '' : 'opacity: 0.5; cursor: not-allowed;'} padding: 6px 14px; margin-top: 2px; border-radius: 8px; font-weight: 500; display:flex; align-items:center; transition: background 0.2s;" title="${hasCreators ? "Generate in a creator's style" : 'Add creators in Extension Settings first'}" onmouseover="if(${hasCreators}) this.style.backgroundColor='#f5f7fa'" onmouseout="this.style.backgroundColor='transparent'">⭐ <span style="margin-left:4px;">Creator Style</span>${avatarHtml}</li>`;
            }

            // Your Style - Coming Soon Badge
            let userAvatar = (DreamAI.options.user && DreamAI.options.user.avatar) ? DreamAI.options.user.avatar : '';
            if (userAvatar && userAvatar.startsWith('http')) {
                userAvatar = 'https://apidev.superlio.ai/content/proxy-image?url=' + encodeURIComponent(userAvatar);
            }
            let userAvatarHtml = userAvatar ? `<img src="${userAvatar}" style="width:20px;height:20px;border-radius:50%;margin-right:8px;object-fit:cover;" />` : `<div style="width:20px;height:20px;border-radius:50%;margin-right:8px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:10px;">👤</div>`;

            let userNameFull = (DreamAI.options.user && DreamAI.options.user.name) ? DreamAI.options.user.name : 'Your';
            let userFirstName = userNameFull.split(' ')[0];
            let styleText = `${userFirstName}'s Style`;

            a += `<li class="your-style-btn disabled" style="padding: 6px 14px; margin-top: 2px; border-radius: 8px; font-weight: 500; display:flex; align-items:center; opacity: 0.55; cursor: default; pointer-events: none;" title="${styleText} - Coming Soon">
                ${userAvatarHtml}
                <span style="color: #4b5563;">${styleText}</span>
                <span style="margin-left: auto; background: #614bfb; color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; line-height: 1;">Coming Soon</span>
            </li>`;

            a += `<li class="open-settings-btn" style="border-top: 1px solid rgba(0, 0, 0, 0.08); margin: 2px 0 0; padding: 8px 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.02); border-radius: 0 0 20px 20px; cursor: pointer; text-align: center;" onmouseover="this.style.background='rgba(0, 0, 0, 0.05)'" onmouseout="this.style.background='rgba(0, 0, 0, 0.02)'">
                <span style="display:flex; flex-direction:column; line-height:1.3; width: 100%; align-items: center;">
                    <a href="#" class="create-prompt" style="font-weight:600; font-size:13px; color:#614bfb; text-decoration:none; display:block;">Personalisation &amp; Settings</a>
                    <span style="font-size:11px; color:#9ca3af;">Settings &middot; Custom Prompts &middot; Creator Style</span>
                </span>
            </li>`;
            a += "</ul>", a += "</div>", this.menu = $(a), $("body").append(this.menu), this.menu.on("mouseleave", function (e) {
                that.hide()
            });
            e()
        },
        show: function (e, t) {
            try {
                if (!this.menu || !this.menu.length) {
                    return;
                }
                let a = this.menu.width(),
                    n = this.menu.height(),
                    r = ($(window).width(), $(window).height()),
                    s = t - n / 2;
                s < 0 ? s = 20 : (bottom = s + n) > r && (s = s - (diff = bottom - r) - 20), this.menu.css({
                    left: e - a / 2,
                    top: s
                }).show();
                // Lock page scroll while popup is visible
                document.body.style.overflow = 'hidden';
                let scrollContainer = document.querySelector('.scaffold-layout__main') || document.querySelector('.application-outlet');
                if (scrollContainer) scrollContainer.style.overflow = 'hidden';
            } catch (err) {
            }
        },
        hide: function () {
            if (!this.menu) return;
            this.menu.hide();
            // Restore page scroll
            document.body.style.overflow = '';
            let scrollContainer = document.querySelector('.scaffold-layout__main') || document.querySelector('.application-outlet');
            if (scrollContainer) scrollContainer.style.overflow = '';
        }
    },
    init: function () {
        let e = DreamAI.fn.get_domain(); - 1 != this.domains.indexOf(e) && DreamAI.ready(function () {
            DreamAI.last_url = document.location.href;

            // Initialize sub-modules in isolated try-catch blocks
            // so that a failure in one doesn't prevent event handlers from registering
            try { DreamAI.comments.init(); } catch (err) { ; }
            try { DreamAI.banners.init(); } catch (err) { ; }
            try { DreamAI.sidebar.init(); } catch (err) { ; }

            // CRITICAL: Event handlers below MUST always register regardless of above failures
            $(document).on("mouseover", ".dreamai-comment-wrap", function (e) {
                let t = e.clientX,
                    a = e.clientY,
                    n = $(this).attr("data-urn"),
                    r = !1;
                return $(this).hasClass("reply") && (r = !0), DreamAI.data.reply = r, DreamAI.data.selected_urn = n, DreamAI.contextMenu.show(t, a), !1
            }), $(document).on("click", ".dreamai-cmenu .tones", async function () {
                let e = $(this).attr("data-tone"),
                    t = "";
                t = $('[data-dreamai-comment-content="' + DreamAI.data.selected_urn + '"]').find(".comments-comment-item__main-content").length > 0 ? $('[data-dreamai-comment-content="' + DreamAI.data.selected_urn + '"]').find(".comments-comment-item__main-content").text() : $('[data-dreamai-content="' + DreamAI.data.selected_urn + '"]').text();

                // ✅ If content still empty, try proximity-based search at click time
                // This is crucial for stale tabs where data attributes may be wiped
                if (!t || t.trim() === "") {

                    // ✅ LinkedIn Article page (/pulse/) - grab title + body directly
                    if (window.location.pathname.includes('/pulse/') || $('article[itemtype*="NewsArticle"]').length) {
                        let articleTitle = $('h1.reader-article-header__title, h1.article-title, article h1').first().text().trim();
                        let $articleContainer = $('.reader-content-blocks-container, .article-content, article .reader-layout__content-container').first();
                        let articleParts = [];
                        if ($articleContainer.length) {
                            $articleContainer.find('p, h1, h2, h3, h4, li, blockquote, div.reader-content-blocks-container__section').each(function () {
                                let txt = $(this).text().trim();
                                if (txt.length > 0) articleParts.push(txt);
                            });
                        }
                        let articleBody = articleParts.length > 0 ? articleParts.join('\n') : $articleContainer.text().replace(/\s{2,}/g, ' ').trim();
                        if (articleBody.length > 20) {
                            t = (articleTitle ? articleTitle + '\n\n' : '') + articleBody.substring(0, 3000);
                        }
                    }

                    // If still empty, try proximity-based search
                    if (!t || t.trim() === "") {
                        // Find the comment box for THIS specific post (by URN)
                        let $commentBox = $('[data-dreamai-urn="' + DreamAI.data.selected_urn + '"]');

                        if ($commentBox.length) {
                            // Use ALL known content selectors, not just data-testid
                            let contentSelectors = [
                                '[data-testid="expandable-text-box"]',
                                ".update-components-text.relative.update-components-update-v2__commentary",
                                ".feed-shared-update-v2__description-wrapper",
                                ".feed-shared-inline-show-more-text",
                                ".feed-shared-text",
                                ".reader-content-blocks-container",
                                "article .reader-layout__content-container",
                                "div[dir='ltr']"
                            ];

                            let commentBoxPosition = $commentBox.offset();
                            let closestContent = null;
                            let minDistance = Infinity;

                            // Collect all visible content elements
                            for (let sel of contentSelectors) {
                                $(sel).each(function () {
                                    let $content = $(this);
                                    let text = $content.text().trim();
                                    if (text.length < 20 || !$content.is(':visible') || $content.closest('.dreamai-cmenu').length) return;

                                    let contentPosition = $content.offset();

                                    // Only consider content that's above the comment box
                                    if (contentPosition && commentBoxPosition && contentPosition.top < commentBoxPosition.top) {
                                        let distance = commentBoxPosition.top - contentPosition.top;

                                        if (distance < minDistance && distance < 1500) {
                                            minDistance = distance;
                                            closestContent = $content;
                                        }
                                    }
                                });
                            }

                            if (closestContent && closestContent.text().trim().length > 0) {
                                t = closestContent.text();
                            } else {
                            }
                        }
                    }

                    // ✅ Last-resort: walk up from the comment box and grab any text
                    if (!t || t.trim() === "") {
                        let $commentBox = $('[data-dreamai-urn="' + DreamAI.data.selected_urn + '"]');
                        if ($commentBox.length) {
                            // Walk up to find the post container (try multiple parent selectors)
                            let $postContainer = $commentBox.closest('[data-urn], .feed-shared-update-v2, .occludable-update, [data-id]');
                            if (!$postContainer.length) {
                                // Generic: go up several levels
                                $postContainer = $commentBox.parent().parent().parent().parent();
                            }
                            if ($postContainer.length) {
                                let commentBoxTop = $commentBox.offset() ? $commentBox.offset().top : Infinity;
                                let textParts = [];
                                $postContainer.find('span, p, h1, h2, h3').each(function () {
                                    let $el = $(this);
                                    let elOffset = $el.offset();
                                    // Only grab text ABOVE the comment box, skip menus/buttons
                                    if (elOffset && elOffset.top < commentBoxTop &&
                                        !$el.closest('.dreamai-cmenu').length &&
                                        !$el.closest('button').length &&
                                        !$el.closest('nav').length &&
                                        $el.is(':visible')) {
                                        let txt = $el.text().trim();
                                        if (txt.length > 15 && txt.length < 5000 && !textParts.includes(txt)) {
                                            textParts.push(txt);
                                        }
                                    }
                                });
                                if (textParts.length > 0) {
                                    // Pick the longest text chunk (most likely the post body)
                                    textParts.sort((a, b) => b.length - a.length);
                                    t = textParts[0].replace(/\s{2,}/g, ' ').trim();
                                }
                            }
                        }
                    }
                }

                /**
                 * Send the Data to backend
                 * Also check if login email is matched to LinkedIn account.
                 */
                let requestPayload = null;
                try {
                    const version = chrome.runtime.getManifest().version;
                    requestPayload = {
                        urn: DreamAI.data.selected_urn,
                        tone: e,
                        content: t.replace(/ +/g, " "),
                        time: Date.now(),
                        version: version
                    };


                    if (!requestPayload.content || requestPayload.content.trim() === "") {
                        DreamAI.comments.insert(requestPayload.urn, "❌ Error: Could not read post content. Please try refreshing the page or clicking the icon again.");
                        DreamAI.loader.hide();
                        return; // Abort the process
                    }

                    DreamAI.comments.setText(requestPayload.urn, "Reading post...");
                    DreamAI.data.force_stop = !0;

                    chrome.runtime.sendMessage( //DreamAI.options.user.email
                        { type: "getCookieEmail", email: DreamAI.options.user.email },
                        (response) => {
                            if (response.success) {
                                DreamAI.API.callendpoint("generate", requestPayload, function (e) {
                                    if (e.loging_required) {
                                        html = DreamAI.popup.login_from();
                                        DreamAI.popup.create(html);
                                        DreamAI.popup.open();
                                        DreamAI.comments.setText(e.urn, "");
                                    } else {
                                        // Handle potential response structure variations
                                        let commentText = e.comments || (e.data && e.data.comments);

                                        if (commentText) {
                                            DreamAI.comments.setText(e.urn, "");
                                            DreamAI.data.force_stop = !1;
                                            DreamAI.comments.insert(e.urn, commentText);
                                        } else {
                                            DreamAI.comments.insert(e.urn, "Error: Could not generate comment.");
                                        }
                                    }
                                    DreamAI.loader.hide();
                                });
                            } else {
                                if (requestPayload) {
                                    DreamAI.comments.setText(requestPayload.urn, "");
                                    DreamAI.data.force_stop = !1;
                                    DreamAI.comments.insert(requestPayload.urn, response.error);
                                }
                                DreamAI.loader.hide();
                            }
                        }
                    );
                } catch (error) {
                    if (requestPayload) {
                        DreamAI.comments.setText(requestPayload.urn, "");
                        DreamAI.data.force_stop = !1;
                        DreamAI.comments.insert(requestPayload.urn, 'Unknown Error!');
                    }
                    DreamAI.loader.hide();
                }


            });
            $(document).on("click", ".creator-style-btn:not(.disabled)", async function () {
                let creatorsList = DreamAI.options.comment_creators || [];
                let activeCreators = creatorsList.filter(c => c && c.active !== false && c.active !== '0' && c.active !== 0);

                if (activeCreators.length === 0) {
                    DreamAI.comments.setText(DreamAI.data.selected_urn, "");
                    DreamAI.data.force_stop = !1;
                    DreamAI.comments.insert(DreamAI.data.selected_urn, "❌ Please activate at least one creator in your extension settings.");
                    DreamAI.contextMenu.hide();
                    return;
                }

                let e = "creator_style";
                let t = "";
                t = $('[data-dreamai-comment-content="' + DreamAI.data.selected_urn + '"]').find(".comments-comment-item__main-content").length > 0 ? $('[data-dreamai-comment-content="' + DreamAI.data.selected_urn + '"]').find(".comments-comment-item__main-content").text() : $('[data-dreamai-content="' + DreamAI.data.selected_urn + '"]').text();

                if (!t || t.trim() === "") {
                    let $commentBox = $('[data-dreamai-urn="' + DreamAI.data.selected_urn + '"]');
                    if ($commentBox.length) {
                        let contentSelectors = [
                            '[data-testid="expandable-text-box"]',
                            ".update-components-text.relative.update-components-update-v2__commentary",
                            ".feed-shared-update-v2__description-wrapper",
                            ".feed-shared-inline-show-more-text",
                            ".feed-shared-text",
                            "div[dir='ltr']"
                        ];
                        let commentBoxPosition = $commentBox.offset();
                        let closestContent = null;
                        let minDistance = Infinity;

                        for (let sel of contentSelectors) {
                            $(sel).each(function () {
                                let $content = $(this);
                                let text = $content.text().trim();
                                if (text.length < 20 || !$content.is(':visible') || $content.closest('.dreamai-cmenu').length) return;
                                let contentPosition = $content.offset();
                                if (contentPosition && commentBoxPosition && contentPosition.top < commentBoxPosition.top) {
                                    let distance = commentBoxPosition.top - contentPosition.top;
                                    if (distance < minDistance && distance < 1500) {
                                        minDistance = distance;
                                        closestContent = $content;
                                    }
                                }
                            });
                        }
                        if (closestContent && closestContent.text().trim().length > 0) {
                            t = closestContent.text();
                        }
                    }
                }

                let requestPayload = null;
                try {
                    const version = chrome.runtime.getManifest().version;
                    requestPayload = {
                        urn: DreamAI.data.selected_urn,
                        tone: "creator_style",
                        content: t.replace(/ +/g, " "),
                        creator_style: 1,
                        time: Date.now(),
                        version: version
                    };

                    if (!requestPayload.content || requestPayload.content.trim() === "") {
                        DreamAI.comments.insert(requestPayload.urn, "❌ Error: Could not read post content.");
                        DreamAI.loader.hide();
                        return;
                    }

                    DreamAI.comments.setText(requestPayload.urn, "Generating in creator style...");
                    DreamAI.data.force_stop = !0;
                    DreamAI.contextMenu.hide();

                    chrome.runtime.sendMessage(
                        { type: "getCookieEmail", email: DreamAI.options.user.email },
                        (response) => {
                            if (response.success) {
                                DreamAI.API.callendpoint("generate", requestPayload, function (e) {
                                    if (e.loging_required) {
                                        html = DreamAI.popup.login_from();
                                        DreamAI.popup.create(html);
                                        DreamAI.popup.open();
                                        DreamAI.comments.setText(e.urn, "");
                                    } else {
                                        let commentText = e.comments || (e.data && e.data.comments);
                                        if (commentText) {
                                            DreamAI.comments.setText(e.urn, "");
                                            DreamAI.data.force_stop = !1;
                                            DreamAI.comments.insert(e.urn, commentText);
                                        } else {
                                            DreamAI.comments.insert(e.urn, "Error: Could not generate comment.");
                                        }
                                    }
                                    DreamAI.loader.hide();
                                });
                            } else {
                                DreamAI.comments.setText(requestPayload.urn, "");
                                DreamAI.data.force_stop = !1;
                                DreamAI.comments.insert(requestPayload.urn, response.error);
                                DreamAI.loader.hide();
                            }
                        }
                    );
                } catch (error) {
                    if (requestPayload) {
                        DreamAI.comments.setText(requestPayload.urn, "");
                        DreamAI.data.force_stop = !1;
                        DreamAI.comments.insert(requestPayload.urn, 'Unknown Error!');
                    }
                    DreamAI.loader.hide();
                }
            });
            $(document).on("click", "#dreamai-popup-close", function () {
                DreamAI.popup.close()
            });
            $(document).on("submit", "#dreamai-login-form", function () {
                var e = $(this),
                    t = $("#dreamai-login-btn"),
                    a = DreamAI.input.serializeToObject($(this).serialize()),
                    n = "";
                return n += DreamAI.form.validateEmpty("username", "Please enter your email or username."), "" == (n += DreamAI.form.validateEmpty("password", "Please enter your password.")) && (t.text("Please Wait...").attr("disabled", "disabled"), DreamAI.API.callendpoint("login", a, function (a) {
                    e.find(".field-error").html(""), a.error ? DreamAI.msg.error(a.msg) : (DreamAI.data.members = a.members, html = DreamAI.popup.memberlist(a.members), $("#dreamai-popup-container").html(html)), t.text("Login").removeAttr("disabled")
                })), !1
            });
            $(document).on("click", ".create-prompt, .open-settings-btn", function () {
                DreamAI.contextMenu.hide();
                return chrome.runtime.sendMessage({
                    action: "optionpage"
                }, function (e) { }), !1
            });
            chrome.runtime.onMessage.addListener(function (e, t, a) {
                DreamAI.msgHandler(e, t, a)
            });

            // Log if running inside an iframe (for debugging)
            if (window !== window.top) {
            }

            // SPA URL change handler — clean up and let arrive.js re-detect
            // With all_frames:true in manifest, arrive.js handles icon attachment
            // inside iframes automatically (LinkedIn detail pages use iframes)
            if (window === window.top) {
                $(window).on("urlchnaged", function () {

                    // Cancel any previous poll/scroll handlers
                    if (DreamAI.data._urlPollTimer) clearInterval(DreamAI.data._urlPollTimer);
                    if (DreamAI.data._scrollHandler) {
                        $(window).off('scroll resize', DreamAI.data._scrollHandler);
                    }
                    // Remove stale SPA overlays
                    $('#dreamai-spa-overlay').remove();

                    // Remove processed markers so arrive.js can re-detect editors
                    // that are newly rendered after SPA navigation
                    setTimeout(function () {
                        $('.dreamai-processed').removeClass('dreamai-processed');
                    }, 1500);
                });
            } // end if (window === window.top)

            $(document).on("click", ".efficiency", function () {
                $(this).hasClass("on") || window.open(DreamAI.base_url + "dashboard", "_blank")
            });

            // Tour info button — must be a delegated handler (not inline onclick)
            // because inline handlers run in page context without chrome API access
            $(document).on("click", ".tour-info-btn", function (e) {
                e.stopPropagation();
                chrome.storage.local.set({ superlio_onboarding_done: false }, function () {
                    if (DreamAI.onboarding) {
                        DreamAI.onboarding.isActive = false;
                        DreamAI.contextMenu.hide();
                        DreamAI.onboarding.start();
                    }
                });
            });
            $(document).on("mouseenter", ".tour-info-btn", function () { $(this).css('opacity', '1'); });
            $(document).on("mouseleave", ".tour-info-btn", function () { $(this).css('opacity', '0.6'); });
            DreamAI.trackURLChange();
        })

    },
    sidebar: {
        init: function () {
            let e = DreamAI.options.user,
                t = DreamAI.options.sbtns;
            if (html = '<div class="dh-sidebar">						<div class="dh_sidebar_top">            			<img style="height:20px" src="' + chrome.runtime.getURL("images/icon-20.png") + '">            			<div>Superlio.ai</div>            		</div>', e ? html += '<div class="dh_useremail">Signed in as: <a href="' + DreamAI.base_url + '" target="_blank">' + e.name + '</a></div>                <div  class="dh_userplan">                    Plan: <a href="' + DreamAI.base_url + 'subscription/" target="_blank">' + e.plan + "</a>                </div>" : html += '<div class="bh_sbtn_wrap">            	<a class="dreamai-btn" href="' + DreamAI.base_url + '" target="_blank" class="login_btn">Login</a>            	</div>', t.length) {
                for (let a in html += '<div class="bh_sbtn_wrap">', t) {
                    html += '<a class="dreamai-btn" href="' + t[a].url + '" target="_blank">' + t[a].name + "</a>";
                }
                html += "</div>"
            }
            html += "</div>", $(DreamAI.extsettings.sidebar).prepend(html)
        }
    },
    banners: {
        items: [],
        currentSlide: 0,
        containerWidth: 0,
        maxIndex: 0,
        id: "#dh_main_banner",
        init: function () {
            let e = this;
            this.create(function (t) {
                let a = $("#dh_main_banner_wrap img"),
                    n = 0;
                a.length ? (a.one("load", function () {
                    n++, n == a.length && ($("#dh_main_banner_wrap").show(), e.setup())
                }).each(function () {
                    this.complete && ($(this).load(), $(this).trigger("load"))
                })) : ($("#dh_main_banner_wrap").show(), e.setup()), $(document).on("click", ".dh_slider_nav a", function () {
                    return $(this).hasClass("next") ? e.moveNext() : e.movePrev(), !1
                }), $(window).resize(function () {
                    e.setup()
                })
            })
        },
        moveToSlide: function (e) {
            let t = e * this.containerWidth,
                a = this.slider.find("li.dh_slide:eq(" + e + ")").height();
            this.slider.css({
                marginLeft: -t + "px",
                height: a + "px"
            })
        },
        moveNext: function () {
            this.currentSlide < this.maxIndex ? this.currentSlide++ : this.currentSlide = 0, this.moveToSlide(this.currentSlide)
        },
        movePrev: function (e) {
            this.currentSlide > 0 ? this.currentSlide-- : this.currentSlide = this.maxIndex, this.moveToSlide(this.currentSlide)
        },
        setup: function () {
            let e = $(this.id),
                t = e.parent().width(),
                a = e.find("li.dh_slide"),
                n = a.length;
            this.containerWidth = t, this.maxIndex = n - 1, this.slider = e, e.css({
                width: t * n + "px"
            }), a.each(function () {
                $(this).css({
                    width: t + "px"
                })
            }), this.moveToSlide(this.currentSlide)
        },
        create: function (e) {
            let t = "",
                a = DreamAI.options.banners;
            if (a) {
                for (let n in this.items = a, t += '<div class="dh_main_banner" id="dh_main_banner_wrap" style="display:none;">', t += '<div class="dh_slider_wrap">', t += '<ul class="dh_slider" id="dh_main_banner">', a) t += '<li class="dh_slide">', t += '<div class="dhb_content">', a[n].image.length && (t += '<img src="' + a[n].image + '" class="dh_thumb" />'), t += "<h3>" + a[n].title + "</h3>", t += a[n].contnet, t += "</div>", t += "</li>";
                t += "</ul>", a.length > 1 && (t += '<div class="dh_slider_nav"><a href="#prev" class="prev">&lsaquo;</a><a href="#prev" class="next">&rsaquo;</a></div>'), t += "</div>", t += "</div>"
            }
            let r = $(DreamAI.extsettings.banners);
            $(t).insertBefore(r), e(t)
        }
    },
    comments: {
        init: function () {
            // Define robust defaults (Dynamic + Hardcoded)
            let defaultSelectors = [
                '[placeholder*="Add a comment"]',
                '[aria-placeholder*="Add a comment"]',
                '[placeholder*="Add comment"]',
                '.tiptap',
                '.ql-editor',
                '.comments-comment-texteditor'
            ];

            // Add WP setting if present
            if (DreamAI.extsettings.comment) {
                defaultSelectors.push(DreamAI.extsettings.comment);
            }

            // Deduplicate and join
            let uniqueSelectors = [...new Set(defaultSelectors)];
            let selectorString = uniqueSelectors.join(', ');


            $(document).arrive(selectorString, {
                existing: !0,
                fireOnAttributesModification: !0
            }, function (e) {
                let $elem = $(this);
                let $editor;

                // Determine if the detected element is the editor itself or a child (placeholder)
                if ($elem.is('.comments-comment-texteditor, .tiptap, .ql-editor, [contenteditable="true"]')) {
                    $editor = $elem;
                } else {
                    $editor = $elem.closest('.comments-comment-texteditor, .tiptap, .ql-editor, [contenteditable="true"], [class*="comment"][class*="editor"]');
                }

                if ($editor.length) {
                    DreamAI.comments.attachIcon($editor);
                }
            });
        },

        attachIcon: function ($commentEditor) {
            // Prevent duplicate processing
            if ($commentEditor.hasClass('dreamai-processed')) {
                return;
            }

            let selector = DreamAI.extsettings.icon;
            let t = !1,
                a = $commentEditor.closest(".comments-comment-item"),
                n = "",
                r = $commentEditor.closest(".feed-shared-update-v2"),
                s = r.closest(".feed-shared-update-v2").attr("data-urn");
            // Robustly find post content using multiple common selectors
            let contentSelectors = [
                '[data-testid="expandable-text-box"]',  // LinkedIn's test ID for post content (Scenario 2)
                ".update-components-text.relative.update-components-update-v2__commentary",
                ".feed-shared-update-v2__description-wrapper",
                ".feed-shared-inline-show-more-text",
                ".feed-shared-text",
                ".reader-content-blocks-container",
                "article .reader-layout__content-container",
                "div[dir='ltr']"
            ];

            let o = null;
            for (let sel of contentSelectors) {
                let found = r.find(sel);
                if (found.length) {
                    o = found;
                    break;
                }
            }

            // ✅ LinkedIn Article page fallback — grab article title + body directly
            if ((!o || !o.length) && (window.location.pathname.includes('/pulse/') || $('article[itemtype*="NewsArticle"]').length)) {
                let $articleBody = $('.reader-content-blocks-container, .article-content, article .reader-layout__content-container').first();
                if ($articleBody.length && $articleBody.text().trim().length > 20) {
                    o = $articleBody;
                }
            }

            // ✅ If content not found in container, use proximity-based search
            // This handles Scenario 2 (global search) AND stale tab re-renders
            if (!o || !o.length) {

                // Get the position of the comment editor
                let editorOffset = $commentEditor.offset();

                // Collect ALL content elements on the page
                let allContentEls = [];
                for (let sel of contentSelectors) {
                    $(sel).each(function () {
                        let $el = $(this);
                        let text = $el.text().trim();
                        if (text.length > 20 && $el.is(':visible') && !$el.closest('.dreamai-cmenu').length) {
                            allContentEls.push($el);
                        }
                    });
                }

                if (allContentEls.length > 0 && editorOffset) {
                    let closestContent = null;
                    let minDistance = Infinity;

                    for (let $content of allContentEls) {
                        let contentOffset = $content.offset();
                        if (!contentOffset) continue;

                        // Only consider content that is ABOVE the comment box (post content is always above)
                        if (contentOffset.top < editorOffset.top) {
                            let distance = editorOffset.top - contentOffset.top;
                            // Prefer the closest content above, within a reasonable distance
                            if (distance < minDistance && distance < 1500) {
                                minDistance = distance;
                                closestContent = $content;
                            }
                        }
                    }

                    if (closestContent && closestContent.text().trim().length > 0) {
                        o = closestContent;
                    }
                }

                if (!o || !o.length) {
                }
            }

            // Find icon wrapper with multiple fallback strategies
            let icon_wrap;

            // Strategy 0: Tiptap / New Editor Structure (Universal Fix)
            // We use stable attributes like 'componentkey' and look for the 'Post' button or 'Image' icon.
            if ($commentEditor.hasClass('tiptap') || $commentEditor.closest('[data-test-id*="tiptap"]').length) {
                // Traverse up to find the main comment box container using generic attributes
                let $container = $commentEditor.closest('[componentkey*="commentBox"], form, .comments-comment-box');

                if ($container.length) {
                    // 1. Try finding the toolbar via the "Image" or "Photo" button
                    let $toolbarBtn = $container.find('button[aria-label*="Image"], button[aria-label*="image"], button[aria-label*="Photo"], button[aria-label*="photo"], svg[data-test-icon="image-medium"]').closest('button');

                    // 2. If not found, try finding the "Smiley" button (Emoji keyboard)
                    if (!$toolbarBtn.length) {
                        $toolbarBtn = $container.find('button[aria-label*="emoji"], button[aria-label*="Emoji"], button[aria-label*="keyboard"], svg[data-test-icon="emoji-face-medium"]').closest('button');
                    }

                    // 3. If still not found, try finding the "Post" button and go to its sibling container
                    if (!$toolbarBtn.length) {
                        let $postBtn = $container.find('button.artdeco-button--primary');
                        if ($postBtn.length) {
                            // The toolbar is often in a sibling div to the Post button's container
                            $toolbarBtn = $postBtn.closest('.display-flex').find('button').first();
                        }
                    }

                    // 4. Structural Fallback: Find the last div in the container that has buttons (likely the toolbar)
                    if (!$toolbarBtn.length) {
                        let $potentialToolbars = $container.find('div').filter(function () {
                            return $(this).find('button').length > 0;
                        });
                        if ($potentialToolbars.length) {
                            // The last one is usually the bottom toolbar
                            let $lastToolbar = $potentialToolbars.last();
                            // Use the first button in that toolbar as reference
                            $toolbarBtn = $lastToolbar.find('button').first();
                        }
                    }

                    // 5. Broader search: go up further from the editor to find nearby buttons
                    if (!$toolbarBtn.length) {
                        let $wider = $commentEditor.closest('section, article, [class*="comment"], [data-urn]');
                        if ($wider.length) {
                            $toolbarBtn = $wider.find('button[aria-label*="Image"], button[aria-label*="image"], button[aria-label*="emoji"], button[aria-label*="Emoji"], [role="button"] svg').closest('button, [role="button"]').first();
                            if ($toolbarBtn.length) {
                            }
                        }
                    }

                    if ($toolbarBtn.length) {
                        // The parent of the button is the toolbar container
                        icon_wrap = $toolbarBtn.parent();
                    } else {
                        // Fallback: Use the comment editor's parent
                        icon_wrap = $commentEditor.parent();
                        // CRITICAL: Force position:relative so our absolute positioning works
                        icon_wrap.css({ 'position': 'relative', 'overflow': 'visible' });

                        // Try to force it to the bottom right if we are in the parent
                        n += " dreamai-fallback-placement";
                    }
                } else {
                    // No container found at all — go directly for the parent
                    icon_wrap = $commentEditor.parent();
                    icon_wrap.css({ 'position': 'relative', 'overflow': 'visible' });
                    n += " dreamai-fallback-placement";
                }
            }

            if (!icon_wrap && $commentEditor.find(".mlA").length) {
                icon_wrap = $commentEditor.find(".mlA");
            } else if (!icon_wrap && selector) {
                try {
                    icon_wrap = selector.split(',').reduce((acc, part) => acc.find(part.trim()), $commentEditor);
                } catch (err) {
                    icon_wrap = null;
                }
            }

            // Ultimate fallback: Look for common LinkedIn action button containers
            if (!icon_wrap || !icon_wrap.length) {
                icon_wrap = $commentEditor.find('[class*="display-flex"]:first');
                if (!icon_wrap.length) {
                    icon_wrap = $commentEditor.find('.ql-editor').parent();
                }
                if (!icon_wrap.length) {
                    // Last resort: prepend to the comment editor itself
                    icon_wrap = $commentEditor;
                }
            }

            // Handle article content when post URN is undefined
            if (s == undefined) {
                s = $commentEditor.closest('[data-urn]').attr('data-urn');
                if (!s) {
                    // Generate temporary URN if still not found
                    s = "urn:li:activity:" + Date.now();
                }
                o = $(DreamAI.extsettings.articleContent);
            }

            let q = s;

            // Check if this is a reply to a comment
            if (icon_wrap.closest(".comments-comment-entity").length > 0) {
                q = icon_wrap.closest(".comments-comment-entity").attr("data-id");
                if (q) {
                    $(`[data-id='${q}']`).find(DreamAI.extsettings.commentContent).attr("data-dreamai-comment-content", q);
                }
            }

            if (a.length) {
                t = !0;
                a.attr("data-dreamai-comment-content", q);
                n = "reply";
            }

            o.length && o.attr("data-dreamai-content", s);
            $commentEditor.attr("data-dreamai-urn", q);

            // Only add icon if it doesn't exist
            if (!icon_wrap.find(".dreamai-comment-wrap").length) {
                icon_wrap.prepend(
                    '<div class="dreamai-comment-wrap ' + n + '" data-urn="' + q + '">' +
                    '<img src="' + chrome.runtime.getURL("images/icon-20.png") + '" />' +
                    '</div>'
                );
                $commentEditor.addClass('dreamai-processed');

                // Trigger onboarding tour on first icon insertion
                if (typeof DreamAI.onboarding !== 'undefined' && !DreamAI.onboarding.isActive && !DreamAI.onboarding._initCalled) {
                    DreamAI.onboarding._initCalled = true;
                    chrome.storage.local.get(['superlio_onboarding_done'], function (r) {
                        if (!r.superlio_onboarding_done) {
                            DreamAI.onboarding.start();
                        } else {
                        }
                    });
                }
            }
        },

        insert: function (e, t) {
            // Find the editor. It could be .ql-editor OR the element with data-dreamai-urn itself (Tiptap)
            let $container = $("[data-dreamai-urn='" + e + "']");
            let a = $container.find(".ql-editor");

            if (!a.length) {
                // If no .ql-editor, assume Tiptap/ContentEditable is the container or inside it
                if ($container.is('[contenteditable="true"]')) {
                    a = $container;
                } else {
                    a = $container.find('[contenteditable="true"]');
                }

                // If still not found, try the container itself as fallback
                if (!a.length) a = $container;
            }

            // Safety check for undefined text
            if (!t) {
                return;
            }

            // ✅ NEW: Handle Placeholder -> Editor Transition
            // If we found a placeholder (no contenteditable), we must CLICK it and WAIT for the real editor.
            if (!$container.is('[contenteditable="true"]') && !$container.find('[contenteditable="true"]').length) {

                // 1. Click the placeholder to trigger LinkedIn's editor creation
                $container.click();
                $container.focus();

                // 2. Poll for the real editor to appear (max 3 seconds)
                let attempts = 0;
                let activationPoller = setInterval(function () {
                    attempts++;
                    // Search for the editor *relative to the container's parent* (since the container might be replaced) or globally by active element
                    // Best bet: find ANY contenteditable near where the placeholder was
                    let $newEditor = $('.tiptap, [contenteditable="true"]').filter(':visible').first();

                    // Or check if the container itself became editable (some frameworks do this)
                    let containerEditable = $container.is('[contenteditable="true"]') || $container.find('[contenteditable="true"]').length > 0;

                    if ($newEditor.length || containerEditable) {
                        clearInterval(activationPoller);

                        // Use the new editor for insertion
                        if ($newEditor.length) a = $newEditor;
                        else if ($container.is('[contenteditable="true"]')) a = $container;
                        else a = $container.find('[contenteditable="true"]');

                        // Proceed with insertion
                        DreamAI.comments._performInsert(a, t);
                    } else if (attempts > 30) {
                        clearInterval(activationPoller);
                        // Fallback: try inserting into original container anyway? No, that would fail.
                    }
                }, 100);
                return; // Stop here, the poller will finish the job
            }

            // If editor is already ready, proceed immediately
            DreamAI.comments._performInsert(a, t);
        },

        _performInsert: function ($editor, text) {
            let n = !0,
                r = 0,
                s = text.split("\n");

            // Clear existing typing interval if any
            if (DreamAI.data.text_interval) clearInterval(DreamAI.data.text_interval);

            // Clear existing content safely
            if ($editor.find('p').length) {
                $editor.empty(); // Clear all paragraphs
            } else {
                $editor.text(''); // Clear text
            }

            DreamAI.data.text_interval = setInterval(function () {
                // Create a paragraph if needed (Tiptap usually needs <p>)
                if (n) {
                    if (s[r]) {
                        wordArray = s[r].split(" ");
                    } else {
                        wordArray = [];
                    }
                    i = 0;
                    p = $("<p></p>");
                    $editor.append(p);
                    n = !1;
                }

                if (wordArray && void 0 !== wordArray[i]) {
                    $editor.find("p:eq(" + r + ")").append(wordArray[i] + " ");
                    if (i == wordArray.length - 1) {
                        n = !0;
                        r++;
                    }
                    i++;
                } else {
                    n = !0;
                    r++;
                }

                // Trigger input event to notify React/LinkedIn of change
                if ($editor[0]) {
                    $editor[0].dispatchEvent(new Event('input', { bubbles: true }));
                }

                (r >= s.length || DreamAI.data.force_stop) && clearInterval(DreamAI.data.text_interval);
            }, 50); // Speed up typing slightly (was 100)
        },

        setText: function (e, t) {
            let $container = $("[data-dreamai-urn='" + e + "']");
            let $editor = $container.find(".ql-editor");

            if (!$editor.length) {
                if ($container.is('[contenteditable="true"]')) {
                    $editor = $container;
                } else {
                    $editor = $container.find('[contenteditable="true"]');
                }
                if (!$editor.length) $editor = $container;
            }

            // Avoid overwriting placeholder text if we are just showing "Reading..."
            // If it's a placeholder, maybe show a toast instead?
            // For now, only set text if it's editable or meant to be a status message
            if ($editor.is('[contenteditable="true"]') || $editor.find('[contenteditable="true"]').length) {
                $editor.text(t);
            } else {
            }
        }
    },
    trackURLChange: function () {
        setInterval(function () {
            let e = document.location.href;
            !1 !== DreamAI.last_url && DreamAI.last_url != e && ($(window).trigger("urlchnaged", {
                old_url: DreamAI.last_url,
                new_url: e
            }), DreamAI.last_url = e)
        }, 1e3)
    },
    msgHandler: function (e, t, a) {
        switch (e.action) {
            case "dreamai_icon":
                e.dreamai_icon ? $(".dreamai-reco-logo").removeClass("hide") : $(".dreamai-reco-logo").addClass("hide"), DreamAI.icon = e.dreamai_icon;
                break;
            case "home_setting":
                DreamAI.homepage.settings = e.setting, DreamAI.homepage.config();
                break;
            case "reload":
                document.location.reload()
        }
        a("")
    },
    track: function (e, t) {
        let a = DreamAI.member;
        void 0 === t && (t = {}), t.token = a.token, t.device = a.device, t.action = e, DreamAI.API.callendpoint("track", t, function (e) { })
    },
    html: {},
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
        showMessage: function (e, t) {
            var a = $('<div class="dreamai_message ' + e + '"></div>').text(t);
            $(".dreamai-popup").append(a), width = a.outerWidth(), height = a.outerHeight(), marginLeft = width / 2, marginTop = height / 2, a.css({
                marginLeft: -marginLeft,
                marginTop: -marginTop
            }), a.fadeIn("slow"), setTimeout(function () {
                a.fadeOut(function () {
                    a.remove()
                })
            }, 2e3)
        }
    },
    fn: {
        get_domain: function () {
            let e = window.location.href;
            return !!(company = new URL(e).hostname.replace(/www.|groceries.|pamacasa.|spesaonline./gi, "").split(".")[0]).length && company
        },
        convertHMS: function (e) {
            let t = e.split(":"),
                a = 0;
            return 3 == t.length ? 3600 * t[0] + 60 * t[1] + +t[2] : 60 * t[0] + +t[1]
        },
        converttoSec: function (e) {
            return (hours = Math.floor(e / 3600), e %= 3600, minutes = Math.floor(e / 60), seconds = e % 60, hours) ? hours + ":" + minutes + ":" + seconds : minutes + ":" + seconds
        },
        has_device_id: function () {
            return void 0 !== DreamAI.member.device
        },
        has_token: function () {
            return !!DreamAI.member && void 0 !== DreamAI.member.token
        },
        is_ready: function (e) {
            let t = this;
            DreamAI.settings.get_options(function (a) {
                if (DreamAI.member = a.member, a.deviceToken, t.has_token()) {
                    if (t.has_device_id()) e(!0);
                    else if (!DreamAI.data.in_progress) {
                        DreamAI.data.in_progress = !0;
                        let n = DreamAI.popup.addDevice();
                        DreamAI.data.popup_created ? $("#dreamai-popup-container").html(n) : DreamAI.popup.create(n)
                    }
                } else DreamAI.data.in_progress || (DreamAI.data.in_progress = !0, DreamAI.API.callendpoint("members", {}, function (e) {
                    e.error ? DreamAI.msg.error(e.msg) : (e.logged_in ? (DreamAI.data.members = e.members, html = DreamAI.popup.memberlist(e.members)) : html = DreamAI.popup.login_from(), DreamAI.popup.create(html), $("#dreamai-popup-container").html(html))
                }));
                e(!1)
            })
        },
        get_age: function (e) {
            let t = new Date(e),
                a = new Date,
                n = parseInt((a.getTime() - t.getTime()) / 1e3),
                r = 86400,
                s = 7 * r,
                o = 30 * r,
                d = 12 * o;
            return (n < 60 ? (time = "Few", unit = "second") : n >= 60 && n < 3600 ? (time = Math.floor(n / 60), unit = "minute") : n >= 3600 && n < r ? (time = Math.floor(n / 3600), unit = "hours") : n >= r && n < s ? (time = Math.floor(n / r), unit = "day") : n >= s && n < o ? (time = Math.floor(n / s), unit = "week") : n >= o && n < d ? (time = Math.floor(n / o), unit = "month") : (time = Math.floor(n / d), unit = "year"), time > 1) ? time + " " + unit + "s ago." : time + " " + unit + " ago."
        },
        get_formatted_view: function (e) {
            let t = "";
            return 1e3 > Number(e) ? e + " views" : e / 1e3 < 999 ? (e = Math.floor(e / 1e3)) + "K views" : (e = (e = (e / 1e6).toFixed(1)).replace(".0", "")) + "M views"
        }
    },
    popup: {
        elem: "",
        create: function (e) {
            return !DreamAI.data.popup_created && (DreamAI.data.popup_created = !0, $html = '<div class="dreamai-popup open" id="dreamai-popup">					<div class="dreamai-popup-header" id="dreamai-popup-header">						<a href="https://www.dreamai.com/" target="_blank" class="dreamai-popup-logo"><img src="' + chrome.runtime.getURL("images/icon-48.png") + '" /></a>						<div class="dreamai-header-right">							<a href="#" class="dreamai-header-icon dreamai-popup-close" id="dreamai-popup-close"><?xml version="1.0" ?><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><defs><style>.cls-1{fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:2px;}</style></defs><title/><g id="cross"><line class="cls-1" x1="7" x2="25" y1="7" y2="25"/><line class="cls-1" x1="7" x2="25" y1="25" y2="7"/></g></svg></a>						</div>					</div>					<div class="dreamai-popup-container" id="dreamai-popup-container">					', void 0 !== e && ($html += e), $html += "</div>				</div>", this.elem = $($html), $("body").append(this.elem), DreamAI.popup.open(), this.elem)
        },
        toggle: function () {
            this.elem.hasClass("open") ? this.close() : this.open()
        },
        open: function () {
            this.elem.addClass("open"), $("body").addClass("dreamai-popup-open")
        },
        close: function () {
            this.elem.removeClass("open"), $("body").removeClass("dreamai-popup-open")
        },
        login_from: function () {
            return html = '<div class="dreamai-content-wrap">				<div class="dreamai-popup-heading">Login to your account.</div>				<div class="dreamai-box">					<a class="dreamai-btn login-li" id="dreamai-login-btn " target="_blank" href="' + DreamAI.base_url + '?autologin=1">Login</a>				</div>			</div>'
        }
    },
    API: {
        callendpoint: function (e, t, a) {
            chrome.runtime.sendMessage({
                action: "API",
                endpoint: e,
                data: t
            }, function (e) {
                a(e)
            })
        }
    },
    settings: {
        get: function (e, t) {
            chrome.runtime.sendMessage({
                action: "getSettings",
                keys: e
            }, function (e) {
                t(e)
            })
        },
        set: function (e, t) {
            chrome.runtime.sendMessage({
                action: "setSettings",
                args: e
            }, function (e) {
                t && t(e)
            })
        },
        get_options: function (e) {
            chrome.runtime.sendMessage({
                action: "options"
            }, function (t) {
                e(t)
            })
        }
    },
    local: {
        setData: function (e, t) {
            var a = JSON.stringify(t);
            localStorage.setItem(e, a)
        },
        getData: function (e) {
            return null != localStorage.getItem(e) && JSON.parse(localStorage.getItem(e))
        },
        updateData: function (e, t) {
            if (null == localStorage.getItem(e)) return !1;
            var a = JSON.parse(localStorage.getItem(e));
            for (keyObj in t) a[keyObj] = t[keyObj];
            var n = JSON.stringify(a);
            localStorage.setItem(e, n)
        }
    },
    input: {
        serializeToObject: function (e) {
            var t = e.split("&"),
                a = {};
            for (var n in t) {
                var r = t[n].split("="),
                    s = r[0].replace("%5B%5D", ""),
                    o = decodeURIComponent(r[1].replace(/\+/g, " "));
                a[s] ? a[s].constructor === Array ? a[s].push(o) : a[s] = [a[s], o] : -1 == r[0].indexOf("%5B%5D") ? a[s] = o : a[s] = [o]
            }
            return a
        }
    },
    form: {
        data: {
            parent_wrap: !1
        },
        trim: function (e) {
            return e.replace(/^\s+|\s+$/, "")
        },
        validateEmpty: function (e, t) {
            var a = "";
            return 0 == document.getElementById(e).value.length ? (a = t, this.display_msg(e, t)) : this.clr_msg(e, t), a
        },
        validateEmail: function (e, t) {
            var a = "",
                n = document.getElementById(e),
                r = this.trim(n.value);
            return /^[^@]+@[^@.]+\.[^@]*\w\w$/.test(r) ? n.value.match(/[\(\)\<\>\,\;\:\\\"\[\]]/) ? (a = t, this.display_msg(e, a)) : this.clr_msg(e, t) : (a = t, this.display_msg(e, a)), a
        },
        validate_fixedLength: function (e, t, a) {
            var n = "",
                r = document.getElementById(e).value.replace(/[\(\)\.\-\ ]/g, ""),
                s = parseInt(t);
            return r.length != s ? (n = a, this.display_msg(e, n)) : this.clr_msg(e, a), n
        },
        is_checked: function (e, t) {
            var a = "";
            return jQuery("#" + e).is(":checked") ? this.clr_msg(e, t) : (a = t, this.display_msg(e, a)), a
        },
        display_msg: function (e, t) {
            var a = e + "_error";
            return DreamAI.form.data.parent_wrap && jQuery("#" + e).parent().addClass("error"), jQuery("#" + e).addClass("error-input"), 0 == jQuery("#" + a).length ? jQuery("#" + e).after('<div class="field-msg error" id="' + a + '">' + t + "</div>") : jQuery("#" + a).text(t), t
        },
        clr_msg: function (e, t) {
            var a, n = e + "_error";
            return t == jQuery("#" + n).html() && (jQuery("#" + n).remove(), DreamAI.form.data.parent_wrap && jQuery("#" + e).parent().removeClass("error"), jQuery("#" + e).removeClass("error-input")), ""
        }
    },
    loader: {
        show: function () {
            jQuery("body").append('<div class="dreamai-loader"></div>')
        },
        hide: function () {
            jQuery(".dreamai-loader").remove()
        }
    },
    log: function (e) {
        this.debug_mode;
    }
};

// ======== Dashboard ↔ Extension Relay ========
// The Prompts page (dev.superlio.ai/prompts/) uses window.postMessage
// because web pages can't access chrome.runtime.sendMessage directly.
// This content script bridges that gap by relaying messages.
window.addEventListener("message", function (event) {
    if (event.source !== window || !event.data) return;

    // Relay: Dashboard asks to fetch a creator's comments
    if (event.data.type === "SUPERLIO_DASHBOARD_FETCH_CREATOR") {
        chrome.runtime.sendMessage({
            action: "FETCH_CREATOR_COMMENTS",
            profileUrl: event.data.payload.profileUrl
        }, function (response) {
            window.postMessage({
                type: "SUPERLIO_EXTENSION_CREATOR_RESULT",
                payload: response
            }, "*");
        });
    }
});

DreamAI.init();
