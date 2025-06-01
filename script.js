document.addEventListener('DOMContentLoaded', function() {

    // サンプル数の計算用
    let sampleCounter = 1;

    //　要素の取得
    const samplesContainer = document.getElementById('samplesContainer');
    const addSampleBtn = document.getElementById('addSampleBtn');
    const generateBtn = document.getElementById('generateBtn');
    const errorContainer = document.getElementById('errorContainer');
    const regexContainer = document.getElementById('regexContainer');
    const regexResult = document.getElementById('regexResult');
    const testContainer = document.getElementById('testContainer');

    // イベント登録
    addSampleBtn.addEventListener('click', addSample);
    generateBtn.addEventListener('click', generateRegex);

    // サンプルを追加
    function addSample() {
        sampleCounter++;
        const sampleHTML = 
        `
            <div class="sample-group" data-sample-id="${sampleCounter}">
                <button class="remove-sample" onclick="removeSample(${sampleCounter})">&times;</button>
                <p>サンプル ${sampleCounter}</p>
                <div>
                    <label>全体文字列</label>
                    <input type="text" class="full-text">
                </div>
                <div>
                    <label>取得したい文字列</label>
                    <input type="text" class="target-text">
                </div>
            </div>
        `;
        samplesContainer.insertAdjacentHTML('beforeend', sampleHTML);
    }

    // サンプルを削除
    window.removeSample = function(sampleId) {
        const sampleElement = document.querySelector(`[data-sample-id="${sampleId}"]`);
        if (sampleElement && samplesContainer.children.length > 1) {
            sampleElement.remove();
            sampleCounter--;
        }
    };

    // データを取得
    function getAllSamples() {
// debug
        // const samples = [];
        const samples = [
            {
                id: 1,
                fullText: 'fullText.test',
                targetText: '.test',
            },
            {
                id: 2,
                fullText: 'fullText2.test2',
                targetText: '.test2',
            },
        ];

        const sampleGroups = document.querySelectorAll('.sample-group');
        
        sampleGroups.forEach((group, index) => {
            const fullText = group.querySelector('.full-text').value.trim();
            const targetText = group.querySelector('.target-text').value.trim();
            
            if (fullText && targetText) {
                samples.push({
                    id: index + 1,
                    fullText: fullText,
                    targetText: targetText,
                });
            }
        });

        return samples;
    }

    // 正規表現を生成(表示)
    function generateRegex() {
        const samples = getAllSamples();

        // エラーチェック
        if (samples.length === 0) {
            showError('少なくとも1つのサンプルで全体文字列と取得したい文字列の両方を入力してください');
            hideResults();
            return;
        }
        for (const sample of samples) {
            if (!sample.fullText.includes(sample.targetText)) {
                showError(`サンプル ${sample.id}: 全体文字列に取得したい文字列が含まれていません`);
                hideResults();
                return;
            }
        }

        try {
             for (const sample of samples) {
                testText = escapeRegExp(sample.targetText);
                testArray.push(testText);
            }
            result = testArray.join(',');
            showRegexResult(result);
        } catch (err) {
            showError('正規表現の生成中にエラーが発生しました: ' + err.message);
            hideResults();
        }
    }

    // 正規表現の特殊文字をエスケープ処理
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // エラー表示
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }

    // エラー非表示
    function hideError() {
        errorContainer.style.display = 'none';
    }

    // 結果表示
    function showRegexResult(regex) {
        regexResult.textContent = regex;
        regexContainer.style.display = 'block';
    }

    // 結果非表示
    function hideResults() {
        regexContainer.style.display = 'none';
        testContainer.style.display = 'none';
    }

});
