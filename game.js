(() => {
  "use strict";

  const TYPES = ["grass", "berry"];
  const ICONS = { grass: "🌿", berry: "🍓" };
  const FLIP = { grass: "berry", berry: "grass" };

  const boardEl = document.getElementById("board");
  const stageNumberEl = document.getElementById("stageNumber");
  const movesLeftEl = document.getElementById("movesLeft");
  const chainCountEl = document.getElementById("chainCount");
  const goalTextEl = document.getElementById("goalText");
  const goalBarEl = document.getElementById("goalBar");
  const messageEl = document.getElementById("message");
  const restartButton = document.getElementById("restartButton");
  const nextButton = document.getElementById("nextButton");

  let stageIndex = 0;
  let stage = null;
  let board = [];
  let movesUsed = 0;
  let collected = { grass: 0, berry: 0 };
  let refillIndex = 0;
  let busy = false;
  let cleared = false;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function loadStage(index) {
    stageIndex = Math.max(0, Math.min(index, window.STEGON_STAGES.length - 1));
    stage = window.STEGON_STAGES[stageIndex];
    board = [...stage.initialBoard];
    movesUsed = 0;
    collected = { grass: 0, berry: 0 };
    refillIndex = 0;
    busy = false;
    cleared = false;
    nextButton.disabled = true;
    messageEl.className = "message";
    messageEl.textContent = "パネルをタップすると、上下左右もくるりん！";
    render();
  }

  function render() {
    stageNumberEl.textContent = stage.id;
    movesLeftEl.textContent = `${Math.max(0, stage.maxMoves - movesUsed)}手`;
    const goalNow = collected[stage.goal.tile] || 0;
    goalTextEl.textContent = `${ICONS[stage.goal.tile]}を ${stage.goal.count}こ あつめよう（${Math.min(goalNow, stage.goal.count)}/${stage.goal.count}）`;
    goalBarEl.style.width = `${Math.min(100, goalNow / stage.goal.count * 100)}%`;

    boardEl.style.setProperty("--size", stage.size);
    boardEl.innerHTML = "";
    board.forEach((type, index) => {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.dataset.type = type;
      tile.dataset.index = String(index);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", type === "grass" ? "草パネル" : "木の実パネル");
      tile.textContent = ICONS[type];
      tile.disabled = busy || cleared;
      tile.addEventListener("click", () => handleMove(index));
      boardEl.appendChild(tile);
    });
  }

  function neighbors(index) {
    const size = stage.size;
    const row = Math.floor(index / size);
    const col = index % size;
    const points = [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    return points
      .filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)
      .map(([r, c]) => r * size + c);
  }

  async function handleMove(index) {
    if (busy || cleared || movesUsed >= stage.maxMoves) return;
    busy = true;
    movesUsed += 1;
    chainCountEl.textContent = "0";

    const affected = neighbors(index);
    document.querySelectorAll(".tile").forEach((tile, i) => {
      tile.disabled = true;
      if (affected.includes(i)) tile.classList.add("flipping");
    });
    await sleep(130);

    affected.forEach(i => { board[i] = FLIP[board[i]]; });
    render();
    await sleep(100);

    let chain = 0;
    while (true) {
      const matches = findMatches();
      if (matches.size === 0) break;
      chain += 1;
      chainCountEl.textContent = String(chain);
      messageEl.textContent = chain === 1 ? "けせた！" : `${chain}れんさ！`;
      await clearMatches(matches);
      collapseAndRefill();
      render();
      await sleep(180);
    }

    if (checkClear()) {
      cleared = true;
      messageEl.className = "message success";
      messageEl.textContent = "クリア！ ステゴンもうれしそう。";
      nextButton.disabled = stageIndex >= window.STEGON_STAGES.length - 1;
    } else if (movesUsed >= stage.maxMoves) {
      messageEl.className = "message";
      messageEl.textContent = "あとちょっと。やりなおしてみよう！";
    } else if (chain === 0) {
      messageEl.textContent = "こんどは、3つならぶ場所をさがしてみよう。";
    }

    busy = false;
    render();
  }

  function findMatches() {
    const size = stage.size;
    const matches = new Set();

    for (let r = 0; r < size; r += 1) {
      let start = 0;
      for (let c = 1; c <= size; c += 1) {
        const same = c < size && board[r * size + c] === board[r * size + start];
        if (!same) {
          if (c - start >= 3) {
            for (let x = start; x < c; x += 1) matches.add(r * size + x);
          }
          start = c;
        }
      }
    }

    for (let c = 0; c < size; c += 1) {
      let start = 0;
      for (let r = 1; r <= size; r += 1) {
        const same = r < size && board[r * size + c] === board[start * size + c];
        if (!same) {
          if (r - start >= 3) {
            for (let y = start; y < r; y += 1) matches.add(y * size + c);
          }
          start = r;
        }
      }
    }

    return matches;
  }

  async function clearMatches(matches) {
    document.querySelectorAll(".tile").forEach((tile, index) => {
      if (matches.has(index)) tile.classList.add("clearing");
    });
    await sleep(170);
    matches.forEach(index => {
      const type = board[index];
      if (type) collected[type] += 1;
      board[index] = null;
    });
  }

  function collapseAndRefill() {
    const size = stage.size;
    for (let c = 0; c < size; c += 1) {
      const column = [];
      for (let r = size - 1; r >= 0; r -= 1) {
        const value = board[r * size + c];
        if (value) column.push(value);
      }
      while (column.length < size) column.push(nextRefill());
      for (let r = size - 1, i = 0; r >= 0; r -= 1, i += 1) {
        board[r * size + c] = column[i];
      }
    }
  }

  function nextRefill() {
    if (stage.refill && stage.refill.length) {
      const value = stage.refill[refillIndex % stage.refill.length];
      refillIndex += 1;
      return value;
    }
    return TYPES[refillIndex++ % TYPES.length];
  }

  function checkClear() {
    return (collected[stage.goal.tile] || 0) >= stage.goal.count;
  }

  restartButton.addEventListener("click", () => loadStage(stageIndex));
  nextButton.addEventListener("click", () => loadStage(stageIndex + 1));

  loadStage(0);
})();
