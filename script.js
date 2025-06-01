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
// debug
        // const samples = [];
        const samples = [
            {
                id: 1,
                fullText: 'fullText.test',
                targetText: 'test',
            },
            {
                id: 2,
                fullText: 'fullText2.test2',
                targetText: 'test2',
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
        const allPatterns = [];

        for (const sample of samples) {
            const patterns = generateAllPossiblePatterns(sample.fullText, sample.targetText);
            allPatterns.push({ sampleId: sample.id, patterns, sample });
        }

        return findBestCommonPattern(allPatterns);
    }

    function generateAllPossiblePatterns(fullText, targetText) {
        const patterns = [];
        let startIndex = 0;

        while (true) {
            const index = fullText.indexOf(targetText, startIndex);
            if (index === -1) break;

            const pattern = generatePatternAtIndex(fullText, targetText, index);
            patterns.push(pattern);

            startIndex = index + 1;
        }

        return patterns;
    }

    function generatePatternAtIndex(fullText, targetText, targetIndex) {
        let escapedTarget = escapeRegExp(targetText);
        const afterTargetIndex = targetIndex + targetText.length;
        const beforeContext = analyzeContext(fullText, targetIndex, 'before');
        const afterContext = analyzeContext(fullText, afterTargetIndex, 'after');
        const capturePattern = `(${escapedTarget})`;

        return {
            before: beforeContext,
            capture: capturePattern,
            after: afterContext,
            original: targetText,
            index: targetIndex,
            score: calculatePatternScore(beforeContext, afterContext, fullText, targetIndex)
        };
    }

    function analyzeContext(fullText, position, direction) {
        if (direction === 'before' && position === 0) return '';
        if (direction === 'after' && position >= fullText.length) return '';

        let contextLength = Math.min(5, direction === 'before' ? position : fullText.length - position);
        let contextText = direction === 'before'
            ? fullText.substring(position - contextLength, position)
            : fullText.substring(position, position + contextLength);

        return createContextPattern(contextText, direction);
    }

    function createContextPattern(text, direction) {
        if (!text) return '';
        let pattern = '';
        for (let i = 0; i < text.length; i++) {
            const actualChar = direction === 'before' ? text[text.length - 1 - i] : text[i];
            pattern = direction === 'before' ? escapeRegExp(actualChar) + pattern : pattern + escapeRegExp(actualChar);
        }
        return pattern;
    }

    function findBestCommonPattern(allPatterns) {
        const candidates = [];
        for (const samplePatterns of allPatterns) {
            const sortedPatterns = samplePatterns.patterns.sort((a, b) => b.score - a.score);
            for (let i = 0; i < Math.min(3, sortedPatterns.length); i++) {
                candidates.push({ pattern: sortedPatterns[i], sampleId: samplePatterns.sampleId });
            }
        }

        let bestPattern = null;
        let bestScore = -1;

        for (const candidate of candidates) {
            const testPattern = createTestPattern(candidate.pattern, allPatterns);
            const score = evaluatePatternOnAllSamples(testPattern, allPatterns);
            if (score > bestScore) {
                bestScore = score;
                bestPattern = testPattern;
            }
        }

        return bestPattern || createFallbackPattern(allPatterns);
    }

    function createTestPattern(basePattern, allPatterns) {
        const commonBefore = findFlexibleCommonContext(allPatterns.flatMap(sp => sp.patterns.map(p => p.before)));
        const commonAfter = findFlexibleCommonContext(allPatterns.flatMap(sp => sp.patterns.map(p => p.after)));
        const targets = allPatterns.map(sp => sp.sample.targetText);
        const capturePattern = createOptimalCapture(targets);
        return `${commonBefore}${capturePattern}${commonAfter}`;
    }

    function findFlexibleCommonContext(contexts) {
        const nonEmptyContexts = contexts.filter(c => c);
        const contextCounts = {};
        nonEmptyContexts.forEach(candidate => {
            contextCounts[candidate] = 0;
            nonEmptyContexts.forEach(other => {
                if (other.includes(candidate)) contextCounts[candidate]++;
            });
        });
        return Object.entries(contextCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '';
    }

    function createOptimalCapture(targets) {
        if (targets.length === 0) return '([^\\s]+)';

        const commonPrefix = getCommonPrefix(targets);
        const commonSuffix = getCommonSuffix(targets);

        const captureMiddle = targets.map(t => t.slice(commonPrefix.length, t.length - commonSuffix.length));

        // 汎用キャプチャ部分（数値や英字など）を判定
        let middlePattern = '.*';
        if (captureMiddle.every(t => /^\d+$/.test(t))) {
            middlePattern = '\\d+';
        } else if (captureMiddle.every(t => /^[a-zA-Z]+$/.test(t))) {
            middlePattern = '[a-zA-Z]+';
        } else if (captureMiddle.every(t => /^[a-zA-Z0-9]+$/.test(t))) {
            middlePattern = '[a-zA-Z0-9]+';
        }

        return escapeRegExp(commonPrefix) + `(${middlePattern})` + escapeRegExp(commonSuffix);
    }

    function getCommonPrefix(strings) {
        if (!strings.length) return '';
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (!strings[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
            }
        }
        return prefix;
    }

    function getCommonSuffix(strings) {
        if (!strings.length) return '';
        let suffix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (!strings[i].endsWith(suffix)) {
                suffix = suffix.slice(1);
            }
        }
        return suffix;
    }

    function evaluatePatternOnAllSamples(pattern, allPatterns) {
        let totalScore = 0;
        for (const { sample } of allPatterns) {
            try {
                const regex = new RegExp(pattern, 'g');
                const matches = Array.from(sample.fullText.matchAll(regex));
                const matchedValues = matches.map(match => match[1] || match[0]);
                if (matchedValues.includes(sample.targetText)) totalScore += 10;
                else if (matchedValues.length > 0) totalScore += 2;
                else totalScore -= 5;
            } catch {
                totalScore -= 10;
            }
        }
        return totalScore;
    }

    function createFallbackPattern(allPatterns) {
        const targets = allPatterns.map(sp => sp.sample.targetText);
        return createOptimalCapture(targets);
    }

    function calculatePatternScore(before, after, fullText, index) {
        let score = (before.length + after.length) * 2;
        const specialChars = ['-', '_', '.', ':', ' ', ',', ';'];
        for (const char of before + after) {
            if (specialChars.includes(char)) score += 5;
        }
        const relativePosition = index / fullText.length;
        if (relativePosition > 0.2 && relativePosition < 0.8) score += 3;
        return score;
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
