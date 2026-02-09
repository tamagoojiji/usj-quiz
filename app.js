(function () {
  "use strict";

  // パスワードハッシュ（SHA-256）
  // デフォルト: "tamago"
  const PASSWORD_HASH = "fd8cc3555bd177051ab89736e5f92adc79326c404556f85e924b2c9ffe3db0e5";

  // 状態管理
  let currentQuestions = [];
  let currentIndex = 0;
  let userAnswers = [];
  let questionCount = 10;

  // DOM要素
  const screens = {
    login: document.getElementById("login-screen"),
    top: document.getElementById("top-screen"),
    quiz: document.getElementById("quiz-screen"),
    result: document.getElementById("result-screen")
  };

  // === 画面遷移 ===
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  // === SHA-256ハッシュ ===
  async function sha256(message) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      // crypto.subtle未対応の場合はプレーンテキスト比較にフォールバック
      return message;
    }
  }

  // プレーンテキストパスワード（crypto.subtle未対応時のフォールバック）
  const PASSWORD_PLAIN = "tamago";

  // === ログイン処理 ===
  async function handleLogin() {
    var input = document.getElementById("password-input");
    var error = document.getElementById("login-error");
    var inputValue = input.value;

    try {
      var hash = await sha256(inputValue);
      var isValid = (hash === PASSWORD_HASH) || (inputValue === PASSWORD_PLAIN);
    } catch (e) {
      var isValid = (inputValue === PASSWORD_PLAIN);
    }

    if (isValid) {
      sessionStorage.setItem("usj_quiz_auth", "1");
      error.classList.add("hidden");
      showScreen("top");
    } else {
      error.classList.remove("hidden");
      input.value = "";
      input.focus();
    }
  }

  // === Fisher-Yatesシャッフル ===
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // === 問題を準備 ===
  function prepareQuestions(count) {
    const shuffled = shuffle(QUIZ_DATA);
    const total = count === 0 ? shuffled.length : Math.min(count, shuffled.length);
    currentQuestions = shuffled.slice(0, total);
    currentIndex = 0;
    userAnswers = [];
    questionCount = total;
  }

  // === クイズ描画 ===
  function renderQuiz() {
    const q = currentQuestions[currentIndex];

    // プログレス
    document.getElementById("question-number").textContent = currentIndex + 1;
    document.getElementById("total-questions").textContent = questionCount;
    document.getElementById("progress-fill").style.width =
      ((currentIndex + 1) / questionCount * 100) + "%";

    // バッジ
    const badge = document.getElementById("question-badge");
    badge.textContent = q.type === "trueFalse" ? "○ ×" : "4択";

    // 問題文
    document.getElementById("question-text").textContent = q.question;

    // 選択肢
    const container = document.getElementById("choices-container");
    container.innerHTML = "";

    // 4択の場合は選択肢をシャッフル
    let displayChoices;
    let correctDisplayIndex;

    if (q.type === "choice") {
      const indices = q.choices.map((_, i) => i);
      const shuffledIndices = shuffle(indices);
      displayChoices = shuffledIndices.map(i => q.choices[i]);
      correctDisplayIndex = shuffledIndices.indexOf(q.answer);
    } else {
      displayChoices = q.choices;
      correctDisplayIndex = q.answer;
    }

    displayChoices.forEach((choice, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = choice;
      btn.addEventListener("click", () => handleAnswer(i, correctDisplayIndex, q, displayChoices));
      container.appendChild(btn);
    });

    // フィードバックを隠す
    document.getElementById("feedback").classList.add("hidden");
    document.getElementById("quiz-body").style.display = "block";
  }

  // === 回答処理 ===
  function handleAnswer(selectedIndex, correctIndex, question, displayChoices) {
    const isCorrect = selectedIndex === correctIndex;

    // ボタン状態を更新
    const buttons = document.querySelectorAll(".choice-btn");
    buttons.forEach((btn, i) => {
      btn.classList.add("disabled");
      if (i === correctIndex) btn.classList.add("correct");
      if (i === selectedIndex && !isCorrect) btn.classList.add("wrong");
    });

    // 回答を記録
    userAnswers.push({
      question: question.question,
      type: question.type,
      userAnswer: displayChoices[selectedIndex],
      correctAnswer: question.choices[question.answer],
      isCorrect: isCorrect,
      explanation: question.explanation
    });

    // フィードバック表示
    const feedback = document.getElementById("feedback");
    const resultEl = document.getElementById("feedback-result");
    const imageEl = document.getElementById("feedback-image");
    const explanationEl = document.getElementById("feedback-explanation");
    const reelEl = document.getElementById("feedback-reel");
    const nextBtn = document.getElementById("next-btn");

    resultEl.textContent = isCorrect ? "正解!" : "不正解...";
    resultEl.className = "feedback-result " + (isCorrect ? "is-correct" : "is-wrong");

    imageEl.src = isCorrect ? "images/correct.png" : "images/wrong.png";
    imageEl.alt = isCorrect ? "正解" : "不正解";

    explanationEl.textContent = question.explanation;

    if (question.reelUrl) {
      reelEl.href = question.reelUrl;
      reelEl.classList.remove("hidden");
    } else {
      reelEl.classList.add("hidden");
    }

    nextBtn.textContent = currentIndex + 1 >= questionCount ? "結果を見る" : "次の問題へ";

    feedback.classList.remove("hidden");

    // フィードバックまでスクロール
    setTimeout(() => {
      feedback.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  // === 次の問題 ===
  function nextQuestion() {
    currentIndex++;
    if (currentIndex >= questionCount) {
      renderResult();
    } else {
      renderQuiz();
    }
  }

  // === 結果画面描画 ===
  function renderResult() {
    showScreen("result");

    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const total = userAnswers.length;
    const percent = Math.round((correctCount / total) * 100);

    // 円グラフ
    const chart = document.getElementById("result-chart");
    const color = percent >= 80 ? "#27AE60" : percent >= 50 ? "#F5A623" : "#E74C3C";
    chart.style.background = `conic-gradient(${color} ${percent * 3.6}deg, #E8EDF2 0deg)`;

    document.getElementById("result-percent").textContent = percent + "%";
    document.getElementById("result-score").textContent = correctCount + " / " + total;

    // メッセージ
    let message;
    if (percent === 100) message = "パーフェクト! USJマスター!";
    else if (percent >= 80) message = "素晴らしい! かなりの物知り!";
    else if (percent >= 60) message = "いい調子! もっと詳しくなれるかも!";
    else if (percent >= 40) message = "まだまだ伸びしろあり!";
    else message = "USJに行って確かめてみよう!";
    document.getElementById("result-message").textContent = message;

    // キャラクター
    const resultImg = document.getElementById("result-image");
    resultImg.src = percent >= 60 ? "images/correct.png" : "images/wrong.png";

    // 復習セクション
    const reviewSection = document.getElementById("review-section");
    const wrongAnswers = userAnswers.filter(a => !a.isCorrect);

    if (wrongAnswers.length > 0) {
      let html = '<h3 class="review-title">間違えた問題</h3>';
      wrongAnswers.forEach((a, i) => {
        html += `
          <div class="review-item">
            <p class="review-question">Q${i + 1}. ${a.question}</p>
            <p class="review-answer user">あなたの回答: ${a.userAnswer}</p>
            <p class="review-answer correct">正解: ${a.correctAnswer}</p>
            <p class="review-explanation">${a.explanation}</p>
          </div>
        `;
      });
      reviewSection.innerHTML = html;
    } else {
      reviewSection.innerHTML = '<p style="text-align:center;color:#27AE60;font-weight:700;">全問正解! お見事!</p>';
    }

    // データ送信（GAS Web App）
    sendAnswerData();
  }

  // === 回答データ送信 ===
  function sendAnswerData() {
    // GAS Web AppのURLが設定されていない場合はスキップ
    var GAS_ENDPOINT = "";
    if (!GAS_ENDPOINT) return;

    try {
      var sessionId = Math.random().toString(36).substring(2, 10);
      var payload = {
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        answers: userAnswers
      };

      fetch(GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // サイレントに無視
    }
  }

  // === イベントリスナー ===
  function init() {
    // セッション確認
    if (sessionStorage.getItem("usj_quiz_auth") === "1") {
      showScreen("top");
    }

    // ログイン
    document.getElementById("login-btn").addEventListener("click", handleLogin);
    document.getElementById("password-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleLogin();
    });

    // 出題数選択
    document.querySelectorAll(".btn-count").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var count = parseInt(this.dataset.count);
        prepareQuestions(count);
        showScreen("quiz");
        renderQuiz();
      });
    });

    // 次の問題
    document.getElementById("next-btn").addEventListener("click", nextQuestion);

    // リトライ
    document.getElementById("retry-btn").addEventListener("click", function () {
      prepareQuestions(questionCount);
      showScreen("quiz");
      renderQuiz();
    });

    // トップに戻る
    document.getElementById("back-top-btn").addEventListener("click", function () {
      showScreen("top");
    });
  }

  init();
})();
