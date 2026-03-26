// superlio-ext-dev 0.2.4/js/onboarding.js
// Loads AFTER dream100.js — DreamAI already exists
// Triggered from dream100.js when the first comment icon is inserted

(function () {
    if (typeof DreamAI === 'undefined') { ; return; }

    DreamAI.onboarding = {
        currentStep: 0,
        isActive: false,
        _initCalled: false,
        overlayElement: null,
        spotlightElement: null,
        tooltipElement: null,

        steps: [
            {
                title: "Welcome to Superlio! 👋",
                desc: "Let's take a quick 30-second tour of how to engage better and faster.",
                target: null,
                pos: "center"
            },
            {
                title: "The Magic Button ✨",
                desc: "Hover over this icon on any LinkedIn comment box to open your style picker.",
                target: ".dreamai-comment-wrap",
                pos: "right"
            },
            {
                title: "Your Command Center 🎛️",
                desc: "This is your style picker — choose exactly how Superlio should Engage.",
                target: ".dreamai-cmenu",
                pos: "right",
                delay: 500,
                onBefore: function () {
                    // Open the popup at the icon's actual position (not 0,0)
                    var cwrap = document.querySelector('.dreamai-comment-wrap');
                    if (cwrap && DreamAI.contextMenu && DreamAI.contextMenu.show) {
                        var rect = cwrap.getBoundingClientRect();
                        var urn = cwrap.getAttribute('data-urn');
                        if (urn) DreamAI.data.selected_urn = urn;
                        DreamAI.contextMenu.show(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    }
                }
            },
            {
                title: "Pretrained Styles 🎭",
                desc: "Friendly, Funny, Professional — pick a tone and the Superlio generates in that tone instantly.",
                target: ".dreamai-cmenu .section-heading",
                pos: "right"
            },
            {
                title: "Learning Mode 🧠",
                desc: "Helps the AI learn what works best for YOUR audience over time.",
                target: ".dreamai-cmenu .efficiency",
                pos: "right"
            },
            {
                title: "Creator Style 🌟",
                desc: "Import any LinkedIn creator's Engaging style and Engage as if they wrote them.",
                target: ".dreamai-cmenu .creator-style-btn",
                pos: "right"
            },
            {
                title: "Your Style 👤",
                desc: "Coming soon — Curate your own unique voice and style powered by writing patterns.",
                target: ".dreamai-cmenu .your-style-btn",
                pos: "right"
            },
            {
                title: "Personalisation & Settings ⚙️",
                desc: "Customise your personality, comment length, and create custom prompt styles here. Let's head there now!",
                target: ".dreamai-cmenu .open-settings-btn",
                pos: "right",
                btnNext: "Go to Settings →"
            }
        ],

        init: function () {
            chrome.storage.local.get(['superlio_onboarding_done'], function (result) {
                if (!result.superlio_onboarding_done && window.location.hostname.includes("linkedin.com")) {
                    DreamAI.onboarding.start();
                }
            });
        },

        start: function () {
            if (this.isActive) return;
            this.isActive = true;
            this.currentStep = 0;
            window.superlioTourActive = true;
            this.buildUI();
            this.goToStep(0);
        },

        buildUI: function () {
            var self = this;

            this.overlayElement = document.createElement('div');
            this.overlayElement.className = 'superlio-tour-overlay';

            this.spotlightElement = document.createElement('div');
            this.spotlightElement.className = 'superlio-tour-spotlight';

            this.tooltipElement = document.createElement('div');
            this.tooltipElement.className = 'superlio-tour-tooltip';

            document.body.appendChild(this.overlayElement);
            document.body.appendChild(this.spotlightElement);
            document.body.appendChild(this.tooltipElement);

            this.tooltipElement.addEventListener('click', function (e) {
                if (e.target.classList.contains('tour-next')) {
                    self.next();
                } else if (e.target.classList.contains('tour-back')) {
                    self.prev();
                } else if (e.target.classList.contains('tour-skip') || e.target.classList.contains('tour-done')) {
                    self.finish();
                }
            });
        },

        goToStep: function (index) {
            var self = this;
            if (index >= this.steps.length) {
                this.finish();
                return;
            }
            if (index < 0) return;

            var step = this.steps[index];
            this.currentStep = index;

            if (step.onBefore) step.onBefore();

            // Build dots
            var dotsHtml = '';
            for (var i = 0; i < this.steps.length; i++) {
                if (this.steps[i].pos !== 'center') {
                    dotsHtml += '<div class="tour-dot ' + (i === index ? 'active' : '') + '"></div>';
                }
            }

            var nextBtnText = step.btnNext || (index === this.steps.length - 1 ? 'Done ✓' : 'Next →');
            var nextBtnClass = index === this.steps.length - 1 ? 'tour-done' : 'tour-next';

            // Back arrow only (no text) — show from step 1 onwards
            var backBtn = index > 0 ? '<button class="tour-back">←</button>' : '';

            this.tooltipElement.innerHTML =
                '<h3 class="tour-title">' + step.title + '</h3>' +
                '<p class="tour-text">' + step.desc + '</p>' +
                '<div class="tour-nav">' +
                backBtn +
                '<button class="tour-skip">Skip</button>' +
                '<div class="tour-dots">' + dotsHtml + '</div>' +
                '<button class="' + nextBtnClass + ' tour-next">' + nextBtnText + '</button>' +
                '</div>';

            this.tooltipElement.setAttribute('data-pos', step.pos);
            this.tooltipElement.className = 'superlio-tour-tooltip';

            var renderDelay = step.delay || 150;

            setTimeout(function () {
                self.positionElements(step);
                self.tooltipElement.classList.add('visible');

                if (step.pos === 'center') {
                    self.tooltipElement.classList.add('centered');
                }
            }, renderDelay);
        },

        positionElements: function (step) {
            if (!step.target) {
                this.spotlightElement.style.opacity = '0';
                this.tooltipElement.style.top = '50%';
                this.tooltipElement.style.left = '50%';
                return;
            }

            var targetEl = document.querySelector(step.target);
            if (!targetEl) {
                this.spotlightElement.style.opacity = '0';
                this.tooltipElement.classList.add('centered');
                return;
            }

            this.spotlightElement.style.opacity = '1';
            var rect = targetEl.getBoundingClientRect();
            var pad = 6;

            if (step.target === '.dreamai-cmenu') {
                pad = 0;
                targetEl.style.zIndex = '99999999';
            } else {
                this.bringToFront(targetEl);
            }

            this.spotlightElement.style.top = (rect.top - pad) + 'px';
            this.spotlightElement.style.left = (rect.left - pad) + 'px';
            this.spotlightElement.style.width = (rect.width + pad * 2) + 'px';
            this.spotlightElement.style.height = (rect.height + pad * 2) + 'px';

            // Smart auto-flip positioning
            var tooltipW = 280;
            var tooltipH = this.tooltipElement.offsetHeight || 150;
            var spacing = 16;
            var pos = step.pos;

            var calcPos = function (p) {
                var r = { fits: true, pos: p, top: 0, left: 0 };
                switch (p) {
                    case 'right':
                        r.top = rect.top + (rect.height / 2) - (tooltipH / 2);
                        r.left = rect.right + spacing + pad;
                        if (r.left + tooltipW > window.innerWidth - 10) r.fits = false;
                        break;
                    case 'left':
                        r.top = rect.top + (rect.height / 2) - (tooltipH / 2);
                        r.left = rect.left - tooltipW - spacing - pad;
                        if (r.left < 10) r.fits = false;
                        break;
                    case 'bottom':
                        r.top = rect.bottom + spacing + pad;
                        r.left = rect.left + (rect.width / 2) - (tooltipW / 2);
                        if (r.top + tooltipH > window.innerHeight - 10) r.fits = false;
                        break;
                    case 'top':
                        r.top = rect.top - tooltipH - spacing - pad;
                        r.left = rect.left + (rect.width / 2) - (tooltipW / 2);
                        if (r.top < 10) r.fits = false;
                        break;
                }
                return r;
            };

            var opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
            var result = calcPos(pos);

            if (!result.fits) {
                var flipped = calcPos(opposite[pos]);
                if (flipped.fits) {
                    result = flipped;
                } else {
                    var sides = ['right', 'bottom', 'left', 'top'];
                    for (var s = 0; s < sides.length; s++) {
                        var attempt = calcPos(sides[s]);
                        if (attempt.fits) { result = attempt; break; }
                    }
                }
            }

            this.tooltipElement.setAttribute('data-pos', result.pos);

            var tTop = Math.max(10, Math.min(result.top, window.innerHeight - tooltipH - 10));
            var tLeft = Math.max(10, Math.min(result.left, window.innerWidth - tooltipW - 10));

            this.tooltipElement.style.top = tTop + 'px';
            this.tooltipElement.style.left = tLeft + 'px';
        },

        bringToFront: function (el) {
            document.querySelectorAll('.superlio-tour-raised').forEach(function (e) {
                e.style.position = e.dataset.origPos || '';
                e.style.zIndex = e.dataset.origZ || '';
                e.style.background = e.dataset.origBg || '';
                e.classList.remove('superlio-tour-raised');
            });

            el.dataset.origPos = window.getComputedStyle(el).position;
            el.dataset.origZ = window.getComputedStyle(el).zIndex;
            el.dataset.origBg = window.getComputedStyle(el).backgroundColor;

            el.classList.add('superlio-tour-raised');
            if (el.dataset.origPos === 'static') {
                el.style.position = 'relative';
            }
            el.style.zIndex = '99999999';

            if (el.tagName.toLowerCase() === 'li' || el.classList.contains('efficiency')) {
                el.style.background = '#ffffff';
                el.style.borderRadius = '8px';
            }
        },

        next: function () {
            if (this.currentStep === 7) {
                this.transitionToPhase2();
            } else {
                this.goToStep(this.currentStep + 1);
            }
        },

        prev: function () {
            if (this.currentStep > 0) {
                this.goToStep(this.currentStep - 1);
            }
        },

        transitionToPhase2: function () {
            var self = this;
            chrome.storage.local.set({
                superlio_onboarding_done: true,
                superlio_onboarding_phase2: true
            }, function () {
                chrome.runtime.sendMessage({ action: 'optionpage' });
                self.cleanup();
            });
        },

        finish: function () {
            var self = this;
            chrome.storage.local.set({ superlio_onboarding_done: true }, function () {
                self.cleanup();
            });
        },

        cleanup: function () {
            this.isActive = false;
            window.superlioTourActive = false;

            if (this.overlayElement) this.overlayElement.remove();
            if (this.spotlightElement) this.spotlightElement.remove();
            if (this.tooltipElement) this.tooltipElement.remove();

            document.querySelectorAll('.superlio-tour-raised').forEach(function (e) {
                e.style.position = e.dataset.origPos || '';
                e.style.zIndex = e.dataset.origZ || '';
                e.style.background = e.dataset.origBg || '';
                e.classList.remove('superlio-tour-raised');
            });

            var menu = document.querySelector('.dreamai-cmenu');
            if (menu) menu.style.zIndex = '';

            var cwrap = document.querySelector('.dreamai-comment-wrap');
            if (cwrap) {
                var event = new MouseEvent('mouseout', { 'bubbles': true, 'cancelable': true });
                cwrap.dispatchEvent(event);
            }
        }
    };

})(); // end IIFE
