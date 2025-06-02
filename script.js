document.addEventListener('DOMContentLoaded', function() {
    // サンプル数の計算用
    let sampleCounter = 1;

    // 要素の取得
    const samplesContainer = document.getElementById('samplesContainer');
    const addSampleBtn = document.getElementById('addSampleBtn');
    const generateBtn = document.getElementById('generateBtn');
    const errorContainer = document.getElementById('errorContainer');
    const regexContainer = document.getElementById('regexContainer');
    const regexResult = document.getElementById('regexResult');
    const testContainer = document.getElementById('testContainer');
    const testResults = document.getElementById('testResults');

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
                    <input type="text" class="full-text" placeholder="例 : test@example.com">
                </div>
                <div>
                    <label>取得したい文字列</label>
                    <input type="text" class="target-text" placeholder="例 : test">
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
        const samples = [];
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

    // 正規表現を生成
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

        hideError();

        try {
            const regex = generateCommonRegex(samples);
            showRegexResult(regex);
            testRegexOnAllSamples(regex, samples);
        } catch (err) {
            showError('正規表現の生成中にエラーが発生しました: ' + err.message);
            hideResults();
        }
    }

    function generateCommonRegex(samples) {
        return createDirectContextPattern(samples);
    }

    function createDirectContextPattern(samples) {
        const contextData = samples.map(sample => {
            const targetIndex = sample.fullText.indexOf(sample.targetText);
            
            if (targetIndex === -1) {
                throw new Error(`ターゲットテキスト "${sample.targetText}" が見つかりません`);
            }
            
            const beforeText = sample.fullText.substring(0, targetIndex);
            const afterText = sample.fullText.substring(targetIndex + sample.targetText.length);
            
            return {
                sample,
                targetIndex,
                beforeText,
                afterText,
                targetText: sample.targetText,
                fullText: sample.fullText
            };
        });

        // ターゲット部分のパターンを生成
        const targets = contextData.map(data => data.targetText);
        const capturePattern = createOptimalCapture(targets);

        // 前後のパターンを分析・生成
        const beforePatterns = contextData.map(data => data.beforeText);
        const afterPatterns = contextData.map(data => data.afterText);

        const beforePattern = createPatternFromTexts(beforePatterns);
        const afterPattern = createPatternFromTexts(afterPatterns);

        // 全体マッチの正規表現を構築
        let fullPattern = '^';
        
        if (beforePattern) {
            fullPattern += beforePattern;
        }
        
        fullPattern += capturePattern;
        
        if (afterPattern) {
            fullPattern += afterPattern;
        }
        
        fullPattern += '$';

        return fullPattern;
    }

    function createPatternFromTexts(texts) {
        if (texts.length === 0) return '';
        
        if (texts.every(text => text === texts[0])) {
            return escapeRegExp(texts[0]);
        }
        
        if (texts.some(text => text === '')) {
            const nonEmptyTexts = texts.filter(text => text !== '');
            if (nonEmptyTexts.length === 0) return '';
            if (nonEmptyTexts.length === 1) return escapeRegExp(nonEmptyTexts[0]) + '?';
            return createGenericPattern(nonEmptyTexts) + '?';
        }
        
        return createGenericPattern(texts);
    }

    function createGenericPattern(texts) {
        if (texts.every(text => /^\//.test(text) && text.length > 1)) {
            return '\/.+';
        }
        
        if (texts.every(text => /^https?:\/\//.test(text))) {
            return 'https?:\\/\\/[^\\/]+';
        }
        
        if (texts.every(text => /@[^@]+$/.test(text))) {
            return '@[^@]+';
        }
        
        if (texts.every(text => /^\d+\-$/.test(text))) {
            return '\\d+\\-';
        }
        
        if (texts.every(text => /^\-\d+$/.test(text))) {
            return '\\-\\d+';
        }
        
        if (texts.every(text => /^\d+$/.test(text))) {
            return '\\d+';
        }
        
        const commonPrefix = findCommonPrefix(texts);
        const commonSuffix = findCommonSuffix(texts);
        
        let pattern = '';
        
        if (commonPrefix && commonPrefix.length > 0) {
            pattern += escapeRegExp(commonPrefix);
            
            const remainingTexts = texts.map(text => text.substring(commonPrefix.length));
            const remainingAfterSuffix = commonSuffix ? 
                remainingTexts.map(text => text.substring(0, text.length - commonSuffix.length)) : 
                remainingTexts;
            
            if (remainingAfterSuffix.some(text => text.length > 0)) {
                if (remainingAfterSuffix.every(text => /^\d+$/.test(text))) {
                    pattern += '\\d+';
                } else if (remainingAfterSuffix.every(text => /^[a-zA-Z]+$/.test(text))) {
                    pattern += '[a-zA-Z]+';
                } else if (remainingAfterSuffix.every(text => /^[a-zA-Z0-9\-_]+$/.test(text))) {
                    pattern += '[a-zA-Z0-9\\-_]+';
                } else {
                    pattern += '.+?';
                }
            }
        } else {
            if (texts.every(text => /^\d+$/.test(text))) {
                pattern += '\\d+';
            } else if (texts.every(text => /^[a-zA-Z]+$/.test(text))) {
                pattern += '[a-zA-Z]+';
            } else if (texts.every(text => /^[a-zA-Z0-9\-_]+$/.test(text))) {
                pattern += '[a-zA-Z0-9\\-_]+';
            } else {
                pattern += '.+';
            }
        }
        
        if (commonSuffix && commonSuffix.length > 0) {
            pattern += escapeRegExp(commonSuffix);
        }
        
        return pattern;
    }

    function findCommonPrefix(strings) {
        if (strings.length === 0 || strings.some(s => !s)) return '';
        
        const minLength = Math.min(...strings.map(s => s.length));
        let commonPrefix = '';
        
        for (let i = 0; i < minLength; i++) {
            const chars = strings.map(s => s[i]);
            if (chars.every(char => char === chars[0])) {
                commonPrefix += chars[0];
            } else {
                break;
            }
        }
        
        return commonPrefix;
    }

    function findCommonSuffix(strings) {
        if (strings.length === 0) return '';
        
        const minLength = Math.min(...strings.map(s => s.length));
        let commonSuffix = '';
        
        for (let i = 1; i <= minLength; i++) {
            const chars = strings.map(s => s[s.length - i]);
            if (chars.every(char => char === chars[0])) {
                commonSuffix = chars[0] + commonSuffix;
            } else {
                break;
            }
        }
        
        return commonSuffix;
    }

    function createOptimalCapture(targets) {
        if (targets.every(isNumeric)) {
            const lengths = targets.map(t => t.length);
            if (lengths.every(len => len === lengths[0])) {
                return `(\\d{${lengths[0]}})`;
            }
            return '(\\d+)';
        }
        
        if (targets.every(isDate)) {
            return '(\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})';
        }
        
        if (targets.every(isEmail)) {
            return '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})';
        }

        if (targets.every(isURL)) {
            return '(https?:\\/\\/[^\\s]+)';
        }

        const hasAlpha = targets.some(t => /[a-zA-Z]/.test(t));
        const hasNumeric = targets.some(t => /\d/.test(t));
        const hasHyphen = targets.some(t => /-/.test(t));
        const hasUnderscore = targets.some(t => /_/.test(t));
        const hasDot = targets.some(t => /\./.test(t));
        const hasSpecialChars = targets.some(t => /[^a-zA-Z0-9\-_\.]/.test(t));

        if (hasSpecialChars) {
            return '([^\\s]+)';
        } else {
            let charClass = '';
            
            if (hasAlpha) charClass += 'a-zA-Z';
            if (hasNumeric) charClass += '0-9';
            if (hasHyphen) charClass += '\\-';
            if (hasUnderscore) charClass += '_';
            if (hasDot) charClass += '\\.';
            
            if (charClass) {
                return `([${charClass}]+)`;
            }
        }

        return '(.+?)';
    }

    function isNumeric(text) {
        return /^\d+$/.test(text);
    }

    function isDate(text) {
        return /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(text) || 
            /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(text);
    }

    function isEmail(text) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text);
    }

    function isURL(text) {
        return /^https?:\/\/[^\s]+$/.test(text);
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 全サンプルで正規表現をテスト
    function testRegexOnAllSamples(regexPattern, samples) {
        try {
            let allTestsHTML = '';
            let allPassed = true;
            
            for (const sample of samples) {
                const re = new RegExp(regexPattern, 'g');
                const matches = Array.from(sample.fullText.matchAll(re));
                
                let testHTML = `<div class="sample-test">`;
                testHTML += `<div class="sample-test-title">サンプル ${sample.id}のテスト結果</div>`;
                
                if (matches.length > 0) {
                    const matchedValues = matches.map(match => match[1] || match[0]);
                    const expectedFound = matchedValues.includes(sample.targetText);
                    
                    testHTML += `<p><strong>マッチ数:</strong> ${matches.length}件</p>`;
                    testHTML += `<p><strong>抽出された値:</strong> ${matchedValues.join(', ')}</p>`;
                    testHTML += `<p><strong>期待値:</strong> ${sample.targetText}</p>`;
                    testHTML += `<p><strong>結果:</strong> <span style="color: ${expectedFound ? 'green' : 'orange'}">${expectedFound ? '✓ 成功' : '⚠ 部分的'}</span></p>`;
                    
                    // ハイライト表示
                    let highlighted = sample.fullText;
                    let offset = 0;
                    
                    for (const match of matches) {
                        const matchStart = match.index + offset;
                        const fullMatchText = match[0];
                        const captureText = match[1] || match[0];
                        const captureIndex = fullMatchText.indexOf(captureText);
                        const captureStart = matchStart + captureIndex;
                        const captureEnd = captureStart + captureText.length;
                        
                        const before = highlighted.substring(0, captureStart);
                        const capture = highlighted.substring(captureStart, captureEnd);
                        const after = highlighted.substring(captureEnd);
                        
                        highlighted = `${before}<mark>${capture}</mark>${after}`;
                        offset += '<mark></mark>'.length;
                    }
                    
                    testHTML += `<p><strong>ハイライト:</strong></p><div style="background-color: #f8fafc; padding: 8px; border-radius: 4px;">${highlighted}</div>`;
                    
                    if (!expectedFound) allPassed = false;
                } else {
                    testHTML += `<p style="color: red;">✗ マッチしませんでした</p>`;
                    allPassed = false;
                }
                
                testHTML += `</div>`;
                allTestsHTML += testHTML;
            }
            
            // 全体的な結果を追加
            const summaryHTML = `
                <div class="sample-test" style="border-left-color: ${allPassed ? 'green' : 'orange'};">
                    <div class="sample-test-title">全体の結果</div>
                    <p><strong>総合評価:</strong> <span style="color: ${allPassed ? 'green' : 'orange'}">${allPassed ? '✓ 全サンプルで成功' : '⚠ 一部サンプルで課題あり'}</span></p>
                    <p>生成された正規表現は${samples.length}個のサンプルでテストされました。</p>
                </div>
            `;
            
            testResults.innerHTML = summaryHTML + allTestsHTML;
            testContainer.style.display = 'block';
        } catch (err) {
            showError('正規表現のテスト中にエラーが発生しました: ' + err.message);
            testContainer.style.display = 'none';
        }
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
