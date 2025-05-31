document.addEventListener('DOMContentLoaded', function() {

    // サンプル数の計算用
    let sampleCounter = 1;

    //　要素の取得
    const samplesContainer = document.getElementById('samplesContainer');
    const addSampleBtn = document.getElementById('addSampleBtn');

    // イベント登録
    addSampleBtn.addEventListener('click', addSample);

    // サンプルを追加
    function addSample() {
        sampleCounter++;
        const sampleHTML = 
        `
            <div>
                <p>サンプル ${sampleCounter}</p>
                <div>
                    <label>全体文字列</label>
                    <input type="text">
                </div>
                <div>
                    <label>取得したい文字列</label>
                    <input type="text">
                </div>
            </div>
        `;
        samplesContainer.insertAdjacentHTML('beforeend', sampleHTML);
    }
});