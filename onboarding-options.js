// superlio-ext-dev 0.2.4/js/onboarding-options.js
// Phase 2 of the onboarding tour — runs on the Options page

(function () {

    window.DreamAI = window.DreamAI || {};

    DreamAI.onboardingOptions = {
        currentStep: 0,
        isActive: false,
        overlayElement: null,
        spotlightElement: null,
        tooltipElement: null,

        steps: [
            {
                title: "Personalise Your AI ✍️",
                desc: "This is where you describe your personality and set your preferred comment length.",
                target: "#tab-personalisation .section-block:first-child",
                pos: "bottom",
                onBefore: function () {
                    // Force switch to Personalisation tab first (page may remember Creator tab)
                    var pBtn = document.querySelector('.tab-btn[data-tab="tab-personalisation"]');
                    if (pBtn && !pBtn.classList.contains('active')) {
                        pBtn.click();
                    }
                }
            },
            {
                title: "Your Personality 👤",
                desc: "Tell the AI about yourself (e.g., 'I am a B2B copywriter') so it writes authentically as you.",
                target: "#personality",
                pos: "bottom"
            },
            {
                title: "Custom Tones 🎨",
                desc: "Create your own preset tones here — like 'Sales Pitch' or 'Thought Leader'. They'll appear in your popup for one-click use.",
                target: "#prompts",
                pos: "bottom"
            },
            {
                title: "Creator Style Tab 🌟",
                desc: "Switch to the Creator Style tab to import other people's writing styles.",
                target: ".tab-btn[data-tab='tab-creators']",
                pos: "bottom",
                onBefore: function () {
                    var btn = document.querySelector('.tab-btn[data-tab="tab-creators"]');
                    if (btn && !btn.classList.contains('active')) {
                        btn.click();
                    }
                }
            },
            {
                title: "Import a Style 📥",
                desc: "Click here to add a LinkedIn creator. The AI will analyze them so that you can write like them.",
                target: "#add_new_slot",
                pos: "bottom",
                onBefore: function () {
                    var btn = document.querySelector('.tab-btn[data-tab="tab-creators"]');
                    if (btn && !btn.classList.contains('active')) {
                        btn.click();
                    }
                }
            },
            {
                title: "You're All Set! 🎉",
                desc: "You know everything you need to know. Head back to LinkedIn and start engaging!",
                target: null,
                pos: "center"
            }
        ],

        init: function () {
            chrome.storage.local.get(['superlio_onboarding_phase2'], function (result) {
                if (result.superlio_onboarding_phase2) {
                    setTimeout(function () {
                        DreamAI.onboardingOptions.start();
                    }, 500);
                }
            });
        },

        start: function () {
            if (this.isActive) return;
            this.isActive = true;
            this.currentStep = 0;
            document.body.style.overflow = 'hidden';
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

            // Build dots (exclude center steps)
            var dotsHtml = '';
            for (var i = 0; i < this.steps.length; i++) {
                if (this.steps[i].pos !== 'center') {
                    dotsHtml += '<div class="tour-dot ' + (i === index ? 'active' : '') + '"></div>';
                }
            }

            var nextBtnText = index === this.steps.length - 1 ? 'Finish ✓' : 'Next →';
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

            // Give extra time for tab switch to render
            var renderDelay = step.onBefore ? 300 : 200;

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
                // Hide spotlight and reset any raised elements from previous step
                this.spotlightElement.style.opacity = '0';
                this.spotlightElement.style.width = '0';
                this.spotlightElement.style.height = '0';
                document.querySelectorAll('.superlio-tour-raised').forEach(function (e) {
                    e.style.position = e.dataset.origPos || '';
                    e.style.zIndex = e.dataset.origZ || '';
                    e.style.background = e.dataset.origBg || '';
                    e.classList.remove('superlio-tour-raised');
                });
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
            var pad = 8;

            this.bringToFront(targetEl);

            this.spotlightElement.style.top = (rect.top - pad) + 'px';
            this.spotlightElement.style.left = (rect.left - pad) + 'px';
            this.spotlightElement.style.width = (rect.width + pad * 2) + 'px';
            this.spotlightElement.style.height = (rect.height + pad * 2) + 'px';

            // Smart positioning with auto-flip
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
                    var sides = ['bottom', 'right', 'top', 'left'];
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

            if (window.getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' || window.getComputedStyle(el).backgroundColor === 'transparent') {
                el.style.background = '#ffffff';
            }
        },

        next: function () {
            this.goToStep(this.currentStep + 1);
        },

        prev: function () {
            if (this.currentStep > 0) {
                this.goToStep(this.currentStep - 1);
            }
        },

        finish: function () {
            var self = this;
            chrome.storage.local.set({
                superlio_onboarding_done: true,
                superlio_onboarding_phase2: false
            }, function () {
                self.cleanup();
            });
        },

        cleanup: function () {
            this.isActive = false;
            document.body.style.overflow = '';

            if (this.overlayElement) this.overlayElement.remove();
            if (this.spotlightElement) this.spotlightElement.remove();
            if (this.tooltipElement) this.tooltipElement.remove();

            document.querySelectorAll('.superlio-tour-raised').forEach(function (e) {
                e.style.position = e.dataset.origPos || '';
                e.style.zIndex = e.dataset.origZ || '';
                e.style.background = e.dataset.origBg || '';
                e.classList.remove('superlio-tour-raised');
            });
        }
    };

    // Auto-init on page load
    document.addEventListener('DOMContentLoaded', function () {
        DreamAI.onboardingOptions.init();
    });

})(); // end IIFE
