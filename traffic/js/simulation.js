// simulation.js - 교통 배분 시뮬레이션 로직

document.addEventListener('DOMContentLoaded', function () {
    console.log("Simulation JS Loaded.");

    if (typeof Chart === 'undefined') {
        console.error("Chart.js library is not loaded!");
        const chartArea = document.getElementById('simChart').parentNode;
        chartArea.innerHTML = '<div class="alert alert-danger">⚠️ Chart.js 라이브러리 로드 실패. 인터넷 연결을 확인하세요.</div>';
        return;
    }


    // --------------------------------------------------------
    // 1. 파라미터 설정 (분석 결과 기반)
    // --------------------------------------------------------
    // 우리가 구한 분석값: 자유속도(uf) = 103.7 km/h, 용량(C) = 1301 대/시
    const PARAMS = {
        uf: 103.7,  // km/h
        capacity: 1301, // vph (Vehicle per Hour)
        alpha: 0.15, // BPR 함수 계수 (표준값)
        beta: 4.0    // BPR 함수 지수 (표준값)
    };

    // 경로 설정 (가정)
    // 경로 A: 단거리 (안현-도리-조남) -> 거리 5km
    // 경로 B: 우회로 (안현-일직-조남) -> 거리 8km
    const ROUTES = {
        A: { distance: 5.0, capacity_scale: 1.0 }, // 기본 용량
        B: { distance: 8.0, capacity_scale: 1.2 }  // 우회로가 조금 더 넓다고 가정 (용량 1.2배)
    };

    // --------------------------------------------------------
    // 2. 차트 초기화
    // --------------------------------------------------------
    const ctx = document.getElementById('simChart').getContext('2d');
    const simChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Route A (단거리)', 'Route B (우회로)'],
            datasets: [{
                label: '예상 소요시간 (분)',
                data: [0, 0],
                backgroundColor: ['rgba(255, 165, 0, 0.7)', 'rgba(78, 205, 196, 0.7)'],
                borderColor: ['rgba(255, 165, 0, 1)', 'rgba(78, 205, 196, 1)'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: '소요시간 (분)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `소요시간: ${context.raw}분`;
                        }
                    }
                }
            }
        }
    });

    // --------------------------------------------------------
    // 3. 계산 로직 (BPR 함수)
    // --------------------------------------------------------
    // Time = (Distance / Speed_Free) * (1 + alpha * (Traffic / Capacity)^beta)
    function calculateTime(traffic, routeConfig) {
        const t0 = (routeConfig.distance / PARAMS.uf) * 60; // 분 단위 변환
        const cap = PARAMS.capacity * routeConfig.capacity_scale;

        // BPR 공식 적용
        const congestionFactor = 1 + PARAMS.alpha * Math.pow((traffic / cap), PARAMS.beta);
        return t0 * congestionFactor;
    }

    // --------------------------------------------------------
    // 4. 업데이트 함수
    // --------------------------------------------------------
    function updateSimulation() {
        const totalQ = parseInt(document.getElementById('totalDemand').value);
        const splitA = parseInt(document.getElementById('splitRatio').value);
        const splitB = 100 - splitA;

        // UI 텍스트 업데이트
        document.getElementById('totalDemandVal').textContent = totalQ;
        document.getElementById('ratioA').textContent = splitA + '%';
        document.getElementById('ratioB').textContent = splitB + '%';

        // 교통량 배분
        const qA = totalQ * (splitA / 100);
        const qB = totalQ * (splitB / 100);

        // 시간 계산
        const tA = calculateTime(qA, ROUTES.A);
        const tB = calculateTime(qB, ROUTES.B);

        // 결과 표시 (소수점 1자리)
        document.getElementById('volA').textContent = Math.round(qA);
        document.getElementById('volB').textContent = Math.round(qB);
        document.getElementById('timeA').textContent = tA.toFixed(1);
        document.getElementById('timeB').textContent = tB.toFixed(1);

        // 총 시스템 통행시간 (Total System Travel Time)
        // (A차량수 * A시간) + (B차량수 * B시간)
        const totalSystemTime = Math.round((qA * tA) + (qB * tB));
        document.getElementById('totalSystemTime').textContent = totalSystemTime.toLocaleString();

        // 균형 상태 판별 (차이 1분 이내)
        const diff = Math.abs(tA - tB);
        const eqMsg = document.getElementById('equilibriumMsg');

        if (diff < 1.0) {
            eqMsg.className = 'alert alert-success';
            eqMsg.innerHTML = '<strong>⚖️ 균형 상태 (Equilibrium)!</strong><br>두 경로의 시간이 거의 같아서 운전자들이 경로를 바꿀 이유가 없는 최적 상태입니다.';
        } else if (tA < tB) {
            eqMsg.className = 'alert alert-warning';
            eqMsg.innerHTML = `⚠️ <strong>불균형</strong>: Route A가 ${diff.toFixed(1)}분 더 빠름<br>운전자들이 A로 몰리게 됩니다.`;
        } else {
            eqMsg.className = 'alert alert-warning';
            eqMsg.innerHTML = `⚠️ <strong>불균형</strong>: Route B가 ${diff.toFixed(1)}분 더 빠름<br>운전자들이 B로 몰리게 됩니다.`;
        }

        // 차트 업데이트 (숫자 값 전달 - toFixed는 문자열 반환하므로)
        simChart.data.datasets[0].data = [parseFloat(tA.toFixed(1)), parseFloat(tB.toFixed(1))];
        simChart.update();
    }

    // --------------------------------------------------------
    // 5. 이벤트 리스너
    // --------------------------------------------------------
    document.getElementById('totalDemand').addEventListener('input', updateSimulation);
    document.getElementById('splitRatio').addEventListener('input', updateSimulation);

    // 초기 실행
    updateSimulation();
});
