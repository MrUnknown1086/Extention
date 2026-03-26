var DreamAI = {
    base_url: "https://app.superlio.ai/",
    init: function () {
        DreamAI.loader.show(), DreamAI.API.callendpoint("user", {}, function (a) {
            html = a.logged_in ? DreamAI.html.profile(a.user) : DreamAI.html.login(), $("#popup_content").html(html), DreamAI.loader.hide()
        })
    },
    API: {
        callendpoint: function (a, s, i) {
            chrome.runtime.sendMessage({
                action: "API",
                endpoint: a,
                data: s
            }, function (a) {
                i(a)
            })
        }
    },
    html: {
        profile: function (a) {
            let html = `
                <div class="white_box">
                    <img src="/images/icon-48.png" class="brand-logo" alt="Superlio">
                    <a href="${a.logout}" target="_blank" class="logout">Logout</a>
                    <div class="settting_top_wrap">
                        <div class="student_picture">
                            <img src="${a.avatar}" alt="Avatar">
                        </div>
                        <div class="student_info_wrap">
                            <div class="student_name">${a.name}</div>
                            <div class="setting_bottom_wrap">
                                <ul>`;

            if (a.mobile !== undefined) {
                html += `<li><span class="profile_lable">Contact:</span><span class="profile_text">${a.mobile}</span></li>`;
            }

            html += `               <li><span class="profile_lable">Email:</span><span class="profile_text">${a.email}</span></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="white_box credit_meter_wrap">
                    <h3>Current Plan</h3>
                    <span class="plan_name">${a.plan}</span>
                    <div class="plan_expiry">
                        <span class="ex_lable">Expiry date:</span>
                        <span class="ex_date">${a.expiry}</span>
                    </div>
                </div>
            `;
            return html;
        },
        login: function () {
            return '<div class="btn_wrap"><a href="' + DreamAI.base_url + '/login/" target="_blank" class="button primary">Login</a></div>';
        }
    },
    input: {
        serializeToObject: function (a) {
            var s = a.split("&"),
                i = {};
            for (var e in s) {
                var t = s[e].split("="),
                    l = t[0].replace("%5B%5D", ""),
                    n = decodeURIComponent(t[1].replace(/\+/g, " "));
                i[l] ? i[l].constructor === Array ? i[l].push(n) : i[l] = [i[l], n] : -1 == t[0].indexOf("%5B%5D") ? i[l] = n : i[l] = [n]
            }
            return i
        }
    },
    msg: {
        success: function (a) {
            this.showMessage("dreamai_success", a)
        },
        error: function (a) {
            this.showMessage("dreamai_error", a)
        },
        warning: function (a) {
            this.showMessage("dreamai_warning", a)
        },
        showMessage: function (a, s) {
            var i = $('<div class="dreamai_message ' + a + '"></div>').text(s);
            $("body").append(i), width = i.outerWidth(), height = i.outerHeight(), marginLeft = width / 2, marginTop = height / 2, i.css({
                marginLeft: -marginLeft,
                marginTop: -marginTop
            }), i.fadeIn("slow"), setTimeout(function () {
                i.fadeOut(function () {
                    i.remove()
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