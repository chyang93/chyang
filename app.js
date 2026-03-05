// 單字例句助手 - 主程式
class VocabularyHelper {
    constructor() {
        // 內建 API Key
        this.apiKey = 'AIzaSyBmqvPTklfEtGtVGUhZ6kXzL03o4vzT49Q';
        this.currentLanguage = 'english';
        this.languageConfig = {
            english: {
                name: '英文',
                code: 'en',
                placeholder: '請輸入英文單字...'
            },
            chinese: {
                name: '中文',
                code: 'zh',
                placeholder: '請輸入中文詞彙...'
            },
            korean: {
                name: '韓文',
                code: 'ko',
                placeholder: '請輸入韓文單字...'
            }
        };
        
        this.init();
    }

    init() {
        // 綁定事件
        document.getElementById('searchBtn').addEventListener('click', () => this.search());
        document.getElementById('wordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });

        // 全域播放按鈕事件（語音朗讀）
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('play-btn')) {
                const encoded = target.dataset.text || '';
                const text = decodeURIComponent(encoded);
                const lang = target.dataset.lang || this.languageConfig[this.currentLanguage].code;
                this.speak(text, lang);
            }
        });

        // 語言切換按鈕
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchLanguage(e.target));
        });
    }

    switchLanguage(btn) {
        // 更新按鈕狀態
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 更新當前語言
        this.currentLanguage = btn.dataset.lang;
        
        // 更新輸入框提示
        const config = this.languageConfig[this.currentLanguage];
        document.getElementById('wordInput').placeholder = config.placeholder;
        
        // 清空結果
        document.getElementById('results').classList.add('hidden');
        document.getElementById('wordInput').value = '';
        document.getElementById('wordInput').focus();
    }

    async search() {
        const word = document.getElementById('wordInput').value.trim();
        if (!word) {
            alert('請輸入單字！');
            return;
        }

        this.showLoading(true);
        
        try {
            // 先嘗試線上生成（Gemini），失敗時使用本地備援模板
            const content = await this.fetchContent(word);
            // 影片改為提供可點擊卡片，避免內嵌失敗
            const videos = this.getVideoLinks(word);
            // 顯示結果
            this.displayResults(word, content, videos);
        } catch (error) {
            console.error('查詢錯誤:', error);
            alert('查詢時發生錯誤，請稍後再試！');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchContent(word) {
        // 使用內建的 API Key 或用戶輸入的 API Key
        const userApiKey = document.getElementById('apiKeyInput')?.value.trim();
        if (userApiKey) {
            this.apiKey = userApiKey;
        }
        
        if (this.apiKey) {
            // 使用 API Key 來呼叫 Gemini

            // 依語言設定最少字數與中文意思需求
            const minWords = this.currentLanguage === 'chinese' ? 6 : 5;
            const meaningRequirement = (this.currentLanguage === 'english' || this.currentLanguage === 'korean')
                ? 'Include word_meaning_zh: a concise Chinese meaning of the queried word (required for English/Korean).'
                : 'word_meaning_zh can mirror the Chinese term if helpful.';

            const liaisonRequirement = this.currentLanguage === 'korean'
                ? 'Include pronunciation_liaison: the actual spoken form after liaison/nasalization (e.g., 한국어 -> 한구거, 음료수 -> 음뇨수).'
                : 'pronunciation_liaison can be empty for non-Korean.';

            const systemPrompt = `You are a language tutor. Return strict JSON with fields: pronunciation (string), pronunciation_liaison (string), word_meaning_zh (string), example_original (target language), example_translation_zh (Chinese), dialog_q_original, dialog_q_translation_zh, dialog_a_original, dialog_a_translation_zh. Keep grammar simple (A1). Word: ${word}. Language: ${this.currentLanguage}. If word is Chinese, respond in Chinese original; if Korean, in Korean original; if English, in English original. Pronunciation: English use KK/IPA, Chinese use Zhuyin, Korean provide Hangul with spacing or romanization and mention liaison if applicable. IMPORTANT: ensure example_original has at least ${minWords} words/tokens; dialog_q_original at least ${minWords} words; dialog_a_original at least ${minWords} words. ${meaningRequirement} ${liaisonRequirement}`;
            try {
                const text = await this.fetchFromGemini(systemPrompt);
                if (text) {
                    // 嘗試解析 JSON 內容
                    const jsonStart = text.indexOf('{');
                    const jsonEnd = text.lastIndexOf('}');
                    const jsonStr = jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
                    const parsed = JSON.parse(jsonStr);
                    const rawPron = parsed.pronunciation || '';
                    const liaisonPron = parsed.pronunciation_liaison || '';
                    const pronunciation = this.currentLanguage === 'korean'
                        ? this.applyKoreanLiaisonHint(liaisonPron || rawPron, word)
                        : rawPron;
                    return {
                        pronunciation,
                        meaningZh: parsed.word_meaning_zh || '',
                        sentence: {
                            original: parsed.example_original || '',
                            translation: parsed.example_translation_zh || ''
                        },
                        dialog: {
                            q: { original: parsed.dialog_q_original || '', translation: parsed.dialog_q_translation_zh || '' },
                            a: { original: parsed.dialog_a_original || '', translation: parsed.dialog_a_translation_zh || '' }
                        },
                        source: 'gemini'
                    };
                }
            } catch (err) {
                console.warn('Gemini parse or request failed:', err);
            }
        }
        // 若無 API 或請求失敗，回退到本地模板（仍確保基本可用）
        const fallback = this.generateFallbackContent(word);
        return { ...fallback, source: 'fallback' };
    }

    generateEnglishContent(word) {
        // 英文例句模板（至少5個單字，初級簡單文法，避免名詞/動詞衝突）
        const sentenceTemplates = [
            { original: `I am learning the word ${word} today.`, translation: `我今天在學習「${word}」這個詞。` },
            { original: `We practice the word ${word} every morning.`, translation: `我們每天早上練習「${word}」這個詞。` },
            { original: `Please try to use ${word} in one easy sentence.`, translation: `請試著用「${word}」造一個簡單句子。` },
            { original: `I heard the word ${word} in a short story.`, translation: `我在一個短故事裡聽到「${word}」。` },
            { original: `Can you say the word ${word} with me slowly?`, translation: `你可以跟我一起慢慢念「${word}」嗎？` },
            { original: `Using ${word} helps me speak with my friends.`, translation: `使用「${word}」能幫助我和朋友交談。` },
            { original: `The word ${word} is easy for beginners to remember.`, translation: `「${word}」對初學者來說很好記。` }
        ];

        // 英文對話模板（至少5個單字，初級簡單文法，內容中性）
        const dialogTemplates = [
            {
                q: { original: `Do you know how to say ${word}?`, translation: `你知道「${word}」怎麼說嗎？` },
                a: { original: `Yes, I can teach you the word ${word}.`, translation: `知道，我可以教你「${word}」。` }
            },
            {
                q: { original: `Can we practice the word ${word} together?`, translation: `我們可以一起練習「${word}」嗎？` },
                a: { original: `Sure, let's say the word ${word} slowly.`, translation: `好啊，我們慢慢念「${word}」。` }
            },
            {
                q: { original: `Where did you first hear the word ${word}?`, translation: `你最初在哪裡聽到「${word}」？` },
                a: { original: `I heard the word ${word} in a short video.`, translation: `我在一個短影片裡聽到「${word}」。` }
            },
            {
                q: { original: `What does the word ${word} mean?`, translation: `「${word}」是什麼意思？` },
                a: { original: `The word ${word} has a simple meaning.`, translation: `「${word}」的意思很簡單。` }
            },
            {
                q: { original: `Can you use ${word} in a short sentence?`, translation: `你可以用「${word}」造一個短句嗎？` },
                a: { original: `Yes, I can make one with ${word}.`, translation: `可以，我可以用「${word}」造句。` }
            }
        ];

        const sentence = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
        const dialog = dialogTemplates[Math.floor(Math.random() * dialogTemplates.length)];

        return { sentence, dialog, meaningZh: `「${word}」的中文意思示例` };
    }

    generateChineseContent(word) {
        // 中文例句模板（至少5個字詞，初級簡單文法，避免詞性衝突）
        const sentenceTemplates = [
            { original: `我今天在課堂上學到「${word}」這個詞。`, translation: `我今天在課堂上學到「${word}」這個詞。` },
            { original: `老師要我們用「${word}」造一個簡單的句子。`, translation: `老師要我們用「${word}」造一個簡單的句子。` },
            { original: `請和我一起慢慢念「${word}」這個詞。`, translation: `請和我一起慢慢念「${word}」這個詞。` },
            { original: `我在短影片裡聽到「${word}」的用法。`, translation: `我在短影片裡聽到「${word}」的用法。` },
            { original: `多練習「${word}」可以幫助我們表達。`, translation: `多練習「${word}」可以幫助我們表達。` },
            { original: `「${word}」這個詞對初學者很重要。`, translation: `「${word}」這個詞對初學者很重要。` }
        ];

        // 中文對話模板（至少5個字詞，初級簡單文法，內容中性）
        const dialogTemplates = [
            {
                q: { original: `你知道「${word}」是什麼意思嗎？`, translation: `你知道「${word}」是什麼意思嗎？` },
                a: { original: `知道，「${word}」的意思很簡單。`, translation: `知道，「${word}」的意思很簡單。` }
            },
            {
                q: { original: `我們可以一起練習「${word}」嗎？`, translation: `我們可以一起練習「${word}」嗎？` },
                a: { original: `可以，一起慢慢念「${word}」。`, translation: `可以，一起慢慢念「${word}」。` }
            },
            {
                q: { original: `你第一次在哪裡聽到「${word}」？`, translation: `你第一次在哪裡聽到「${word}」？` },
                a: { original: `我在影片裡聽到「${word}」。`, translation: `我在影片裡聽到「${word}」。` }
            },
            {
                q: { original: `可以用「${word}」造一個句子嗎？`, translation: `可以用「${word}」造一個句子嗎？` },
                a: { original: `可以，我來試著用「${word}」。`, translation: `可以，我來試著用「${word}」。` }
            }
        ];

        const sentence = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
        const dialog = dialogTemplates[Math.floor(Math.random() * dialogTemplates.length)];

        return { sentence, dialog, meaningZh: `「${word}」的中文意思示例` };
    }

    generateKoreanContent(word) {
        // 韓文例句模板（至少5個單字，初級簡單文法，內容中性）
        const sentenceTemplates = [
            { original: `오늘 수업에서 ${word} 단어를 배웠어요.`, translation: `我今天在課堂上學到「${word}」這個單字。` },
            { original: `${word} 단어를 천천히 함께 연습해요.`, translation: `我們一起慢慢練習「${word}」這個單字。` },
            { original: `짧은 영상에서 ${word} 단어를 들었어요.`, translation: `我在短影片裡聽到「${word}」這個單字。` },
            { original: `${word} 단어를 자주 쓰면 말하기가 쉬워요.`, translation: `常用「${word}」這個單字，說話會更容易。` },
            { original: `처음 배우는 사람에게 ${word} 단어가 중요해요.`, translation: `對初學者來說，「${word}」這個單字很重要。` }
        ];

        // 韓文對話模板（至少5個單字，初級簡單文法，內容中性）
        const dialogTemplates = [
            {
                q: { original: `${word} 단어 뜻을 알아요?`, translation: `你知道「${word}」的意思嗎？` },
                a: { original: `네, ${word} 뜻은 간단해요.`, translation: `知道，「${word}」的意思很簡單。` }
            },
            {
                q: { original: `${word} 단어를 같이 연습할까요?`, translation: `我們一起練習「${word}」這個單字好嗎？` },
                a: { original: `네, 천천히 ${word}를 말해 봐요.`, translation: `好，一起慢慢說「${word}」。` }
            },
            {
                q: { original: `어디서 ${word} 단어를 들었어요?`, translation: `你在哪裡聽到「${word}」這個單字？` },
                a: { original: `짧은 영상에서 ${word}를 들었어요.`, translation: `我在短影片裡聽到「${word}」。` }
            },
            {
                q: { original: `${word} 단어로 문장을 만들 수 있어요?`, translation: `可以用「${word}」造句嗎？` },
                a: { original: `네, ${word}로 간단한 문장을 만들 수 있어요.`, translation: `可以，我可以用「${word}」造一個簡單的句子。` }
            }
        ];

        const sentence = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
        const dialog = dialogTemplates[Math.floor(Math.random() * dialogTemplates.length)];

        return { sentence, dialog, meaningZh: `「${word}」的中文意思示例` };
    }

    generateFallbackContent(word) {
        // 使用先前的模板作為備援
        switch (this.currentLanguage) {
            case 'english':
                return this.generateEnglishContent(word);
            case 'chinese':
                return this.generateChineseContent(word);
            case 'korean':
                return this.generateKoreanContent(word);
            default:
                return this.generateEnglishContent(word);
        }
    }

    getPronunciation(word) {
        switch (this.currentLanguage) {
            case 'english':
                return `KK：/${this.roughEnglishKK(word) || 'ˈwɝd'}/（示意，請確認）`;
            case 'chinese':
                return `注音：${this.fakeZhuyin(word) || 'ㄗˋ ㄉㄢˇ'}`;
            case 'korean':
                return `讀音：${this.applyKoreanLiaisonHint(this.fakeHangulRomanize(word) || word, word)}`;
            default:
                return '';
        }
    }

    speak(text, langCode = 'en') {
        if (!text) return;
        const synth = window.speechSynthesis;
        if (!synth) return;
        const utter = new SpeechSynthesisUtterance(text);
        // 盡量用對應的語系
        if (langCode === 'zh') utter.lang = 'zh-TW';
        else if (langCode === 'ko') utter.lang = 'ko-KR';
        else utter.lang = 'en-US';
        synth.cancel();
        synth.speak(utter);
    }

    // 簡易英文 KK 估計（僅示意，不保證準確）
    roughEnglishKK(word) {
        if (!word) return '';
        const lower = word.toLowerCase();
        return lower.replace(/[^a-z]/g, '').replace(/tion$/,'ʃən').replace(/ing$/,'ɪŋ').replace(/ee/g,'i').replace(/oo/g,'u').replace(/ph/g,'f').replace(/th/g,'θ');
    }

    // 簡易注音示意：以字元間空格呈現，無法自動精確轉換
    fakeZhuyin(word) {
        if (!word) return '';
        return word.split('').join(' ');
    }

    // 粗略韓文讀音示意：保留原字串；若為拉丁字母則回傳同字
    fakeHangulRomanize(word) {
        if (!word) return '';
        const hangulRegex = /[\uac00-\ud7af]/;
        if (!hangulRegex.test(word)) return word;
        const liaison = this.koreanLiaisonExample(word);
        return liaison ? `${word} (發音示例: ${liaison})` : `${word} (發音示例)`;
    }

    applyKoreanLiaisonHint(pronunciation, word) {
        // 簡易連音化說明：針對常見案例（如 한국어 → 한구거）
        const targets = [
            { pattern: /한국어/, hint: '한국어 → 한구거（因鼻音化 ㄹ→ㄴ）' },
            { pattern: /국어/, hint: '국어 → 구거（因鼻音化 ㄹ→ㄴ）' }
        ];

        let result = pronunciation || '';
        for (const t of targets) {
            if ((word && t.pattern.test(word)) || t.pattern.test(result)) {
                if (!result.includes(t.hint)) {
                    result = `${result}（連音化示例：${t.hint}）`;
                }
                break;
            }
        }
        return result;
    }

    koreanLiaisonExample(word) {
        if (!word) return '';
        if (/한국어/.test(word)) return '한구거';
        if (/국어/.test(word)) return '구거';
        return '';
    }

    getVideoLinks(word) {
        const encodedWord = encodeURIComponent(word);
        switch (this.currentLanguage) {
            case 'english':
                return [
                    { title: `「${word}」發音短片`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+pronunciation+shorts&sp=EgQQARgB` },
                    { title: `「${word}」用法講解`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+meaning+english+shorts&sp=EgQQARgB` },
                    { title: `「${word}」會話例句`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+conversation+english+shorts&sp=EgQQARgB` }
                ];
            case 'chinese':
                return [
                    { title: `「${word}」中文發音`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+中文+發音+shorts&sp=EgQQARgB` },
                    { title: `「${word}」中文用法`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+中文+用法+shorts&sp=EgQQARgB` },
                    { title: `「${word}」中文會話`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+中文+會話+shorts&sp=EgQQARgB` }
                ];
            case 'korean':
                return [
                    { title: `「${word}」韓文發音`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+한국어+발음+shorts&sp=EgQQARgB` },
                    { title: `「${word}」韓文用法`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+한국어+표현+shorts&sp=EgQQARgB` },
                    { title: `「${word}」韓文會話`, source: 'YouTube 搜尋', url: `https://www.youtube.com/results?search_query=${encodedWord}+한국어+회화+shorts&sp=EgQQARgB` }
                ];
            default:
                return [];
        }
    }

    displayResults(word, content, videoQueries) {
        const config = this.languageConfig[this.currentLanguage];
        const pronunciation = content.pronunciation || this.getPronunciation(word);
        
        const meaningBlock = (this.currentLanguage === 'english' || this.currentLanguage === 'korean') && content.meaningZh
            ? `<div class="meaning-zh">中文意思：${content.meaningZh}</div>`
            : '';

        const encodeAttr = (txt) => encodeURIComponent(txt || '');
        const langCode = config.code;

        // 顯示單字與發音
        document.getElementById('wordDisplay').innerHTML = `
            <div class="word-main">${word}
                <button class="play-btn" data-text="${encodeAttr(word)}" data-lang="${langCode}" title="播放發音">▶</button>
            </div>
            <div class="pronunciation">${pronunciation}</div>
            ${meaningBlock}
            <div class="language-tag">語言：${config.name}</div>
        `;

        // 顯示例句（只有中文翻譯）
        document.getElementById('sentenceDisplay').innerHTML = `
            <div class="sentence-original">${content.sentence.original}
                <button class="play-btn" data-text="${encodeAttr(content.sentence.original)}" data-lang="${langCode}" title="播放例句">▶</button>
            </div>
            <div class="sentence-translation">📝 ${content.sentence.translation}</div>
        `;

        // 顯示對話（只有中文翻譯）
        document.getElementById('dialogDisplay').innerHTML = `
            <div class="dialog-line question">
                <div class="speaker">👤 A：</div>
                <div class="dialog-original">${content.dialog.q.original}
                    <button class="play-btn" data-text="${encodeAttr(content.dialog.q.original)}" data-lang="${langCode}" title="播放提問">▶</button>
                </div>
                <div class="dialog-translation">📝 ${content.dialog.q.translation}</div>
            </div>
            <div class="dialog-line answer">
                <div class="speaker">👤 B：</div>
                <div class="dialog-original">${content.dialog.a.original}
                    <button class="play-btn" data-text="${encodeAttr(content.dialog.a.original)}" data-lang="${langCode}" title="播放回答">▶</button>
                </div>
                <div class="dialog-translation">📝 ${content.dialog.a.translation}</div>
            </div>
        `;

        // 改為連結卡片，避免 iframe 播放被封鎖
        const videoHtml = videoQueries.map((v) => `
            <a class="video-card" href="${v.url}" target="_blank" rel="noopener noreferrer">
                <div class="video-card-title">🎬 ${v.title}</div>
                <div class="video-card-meta">來源：${v.source}</div>
            </a>
        `).join('');
        document.getElementById('videoDisplay').innerHTML = videoHtml || '<p class="video-hint">暫無影片，請稍後再試</p>';

        // 顯示結果區
        document.getElementById('results').classList.remove('hidden');
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
        if (show) {
            document.getElementById('results').classList.add('hidden');
        }
    }

    async fetchFromGemini(prompt) {
        // ✅ 修改這裡：使用您清單中有的最新模型 gemini-2.5-flash
        const MODEL_NAME = "gemini-2.5-flash";
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${this.apiKey}`;

        const payload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        try {
            console.log(`正在連線至: ${MODEL_NAME}...`);

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Gemini API 錯誤 (${response.status}): ${errorData}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error("API 回傳了空的內容");
            }

        } catch (error) {
            console.error("Gemini 請求失敗:", error);
            throw error;
        }
    }
}

// 啟動應用程式
document.addEventListener('DOMContentLoaded', () => {
    new VocabularyHelper();
});
