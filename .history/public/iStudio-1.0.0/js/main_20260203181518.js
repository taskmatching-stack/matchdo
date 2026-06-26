(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();
    
    
    // Initiate the wowjs
    new WOW().init();


    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').addClass('bg-white shadow-sm').css('top', '0px');
        } else {
            $('.sticky-top').removeClass('bg-white shadow-sm').css('top', '-150px');
        }
    });
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // Header carousel
    $(".header-carousel").owlCarousel({
        autoplay: true,
        smartSpeed: 1000,
        loop: true,
        dots: true,
        items: 1
    });


    // Testimonials carousel
    $(".testimonial-carousel").owlCarousel({
        items: 1,
        autoplay: true,
        smartSpeed: 1000,
        animateIn: 'fadeIn',
        animateOut: 'fadeOut',
        dots: true,
        loop: true,
        nav: false
    });
    

    // AI 估價表單提交
    $('#aiForm').on('submit', function (e) {
        e.preventDefault();
        var formData = new FormData(this);
        $('#aiResult').html('<div class="text-center">AI 分析中，請稍候...</div>');
        $.ajax({
            url: '/api/analyze',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                if (res.success) {
                    let html = `<h5>總估價：<span class="text-primary">$${res.total}</span></h5>`;
                    html += '<div class="table-responsive"><table class="table table-bordered mt-3"><thead><tr><th>項目</th><th>規格</th><th>數量</th><th>單位</th><th>單價</th><th>小計</th></tr></thead><tbody>';
                    res.details.forEach(function (item) {
                        html += `<tr><td>${item.item}</td><td>${item.spec}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.matched_price}</td><td>${item.subtotal}</td></tr>`;
                    });
                    html += '</tbody></table></div>';
                    $('#aiResult').html(html);
                } else {
                    $('#aiResult').html('<div class="text-danger">AI 分析失敗</div>');
                }
            },
            error: function (xhr) {
                let msg = '系統忙碌中，請稍後再試';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                $('#aiResult').html('<div class="text-danger">' + msg + '</div>');
            }
        });
    });

})(jQuery);

