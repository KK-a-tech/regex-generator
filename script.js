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
            
            const beforeChar = targetIndex > 0 ? sample.fullText[targetIndex - 1] : '';
            const afterIndex = targetIndex + sample.targetText.length;
            const afterChar = afterIndex < sample.fullText.length ? sample.fullText[afterIndex] : '';

            const beforeContext = targetIndex > 0 ? sample.fullText.substring(Math.max(0, targetIndex - 3), targetIndex) : '';
            const afterContext = afterIndex < sample.fullText.length ? sample.fullText.substring(afterIndex, Math.min(sample.fullText.length, afterIndex + 3)) : '';
            
            return {
                sample,
                targetIndex,
                beforeChar,
                afterChar,
                beforeContext,
                afterContext,
                targetText: sample.targetText
            };
        });

        const commonBeforeChar = findCommonCharacter(contextData.map(data => data.beforeChar));
        const commonAfterChar = findCommonCharacter(contextData.map(data => data.afterChar));

        const targets = contextData.map(data => data.targetText);
        const capturePattern = createOptimalCapture(targets);

        let pattern = '';

        if (commonBeforeChar && commonBeforeChar !== '') {
            pattern += escapeRegExp(commonBeforeChar);
        }

        pattern += capturePattern;

        if (commonAfterChar && commonAfterChar !== '') {
            pattern += escapeRegExp(commonAfterChar);
        }

        if (pattern === capturePattern) {
            return createFallbackWithContext(contextData);
        }
        
        return pattern;
    }

    function findCommonCharacter(characters) {
        if (characters.length === 0) return '';
        
        const firstChar = characters[0];
        const isCommon = characters.every(char => char === firstChar);
        
        return isCommon ? firstChar : '';
    }

    function createFallbackWithContext(contextData) {
        const beforeContexts = contextData.map(data => data.beforeContext);
        const afterContexts = contextData.map(data => data.afterContext);
        
        const commonBefore = findCommonSuffix(beforeContexts);
        const commonAfter = findCommonPrefix(afterContexts);
        
        const targets = contextData.map(data => data.targetText);
        const capturePattern = createOptimalCapture(targets);
        
        let pattern = '';
        
        if (commonBefore && commonBefore.length > 0) {
            pattern += escapeRegExp(commonBefore);
        }
        
        pattern += capturePattern;
        
        if (commonAfter && commonAfter.length > 0) {
            pattern += escapeRegExp(commonAfter);
        }
        
        if (pattern === capturePattern) {
            return createPositionSpecificPattern(contextData);
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
        if (strings.length === 0 || strings.some(s => !s)) return '';
        
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

    function createPositionSpecificPattern(contextData) {
        const positionAnalysis = contextData.map(data => {
            const { sample, targetText } = data;
            const allMatches = [];
            let searchIndex = 0;

            while (true) {
                const index = sample.fullText.indexOf(targetText, searchIndex);
                if (index === -1) break;
                allMatches.push(index);
                searchIndex = index + 1;
            }
            
            const targetPosition = allMatches.indexOf(data.targetIndex);
            
            return {
                ...data,
                allMatches,
                targetPosition,
                totalMatches: allMatches.length
            };
        });

        const positions = positionAnalysis.map(analysis => analysis.targetPosition);
        const hasCommonPosition = positions.every(pos => pos === positions[0] && pos !== -1);
        
        if (hasCommonPosition && positions[0] > 0) {
            const firstSample = contextData[0];
            const delimiter = firstSample.beforeChar;
            
            if (delimiter && ['-', '.', '_', ':', ' ', ',', ';', '/', '\\'].includes(delimiter)) {
                const targets = contextData.map(data => data.targetText);
                const capturePattern = createOptimalCapture(targets);
                const escapedDelimiter = escapeRegExp(delimiter);

                const position = positions[0];
                if (position === 1) {
                    return `${escapedDelimiter}[^${delimiter}]*${escapedDelimiter}${capturePattern}`;
                }
            }
        }

        const targets = contextData.map(data => data.targetText);
        return createOptimalCapture(targets);
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

        const hasAlpha = targets.some(t => /[a-zA-Z]/.test(t));
        const hasNumeric = targets.some(t => /\d/.test(t));
        const hasSpecialChars = targets.some(t => /[^a-zA-Z0-9]/.test(t));

        if (hasSpecialChars) {
            return '([^\\s]+)';
        } else if (hasAlpha && hasNumeric) {
            return '([a-zA-Z0-9]+)';
        } else if (hasNumeric) {
            return '(\\d+)';
        } else if (hasAlpha) {
            return '([a-zA-Z]+)';
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
