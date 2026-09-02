(() => {
  "use strict";

  const TYPES = ["grass", "berry"];
  const ICONS = { grass: "🌿", berry: "🍓" };
  const FLIP = { grass: "berry", berry: "grass" };
  const TIMING = {
    flip: 310,
    reducedFlip: 220,
    neighborDelay: 55,
    settle: 35,
    clear: 210,
    drop: 270,
    refill: 300
  };

  const $ = id => document.getElementById(id);
  const elements = {
    board: $("board"),
    stage: $("stageNumber"),
    moves: $("movesLeft"),
    chain: $("chainCount"),
    goal: $("goalText"),
    goalBar: $("goalBar"),
    message: $("message"),
    callout: $("chainCallout"),
    restart: $("restartButton"),
    next: $("nextButton")
  };

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  let stageIndex = 0;
  let state;

  function validateStage(candidate) {
    const required = ["id", "size", "maxMoves", "goal", "initialBoard", "refill", "mechanics", "difficulty"];
    const missing = required.filter(key => candidate[key] === undefined);
    if (missing.length) throw new Error(`Stage ${candidate.id || "?"}: missing ${missing.join(", ")}`);
    if (!Number.isInteger(candidate.size) || candidate.size < 3 || candidate.size > 6) throw new Error(`Stage ${candidate.id}: invalid size`);
    if (candidate.initialBoard.length !== candidate.size ** 2) throw new Error(`Stage ${candidate.id}: board size mismatch`);
    if (!candidate.initialBoard.every(tile => TYPES.includes(tile))) throw new Error(`Stage ${candidate.id}: unknown tile`);
    if (!TYPES.includes(candidate.goal.tile) || candidate.goal.type !== "collect") throw new Error(`Stage ${candidate.id}: unsupported goal`);
    if (!candidate.refill.length || !candidate.refill.every(tile => TYPES.includes(tile))) throw new Error(`Stage ${candidate.id}: invalid refill`);
    if (!Array.isArray(candidate.mechanics)) throw new Error(`Stage ${candidate.id}: invalid mechanics`);
    return candidate;
  }

  function loadStage(index) {
    stageIndex = Math.max(0, Math.min(index, window.STEGON_STAGES.length - 1));
    const stage = validateStage(window.STEGON_STAGES[stageIndex]);
    state = {
      stage,
      board: [...stage.initialBoard],
      movesUsed: 0,
      collected: { grass: 0, berry: 0 },
      refillIndex: 0,
      busy: false,
      cleared: false
    };

    elements.next.disabled = true;
    elements.message.className = "message";
    elements.message.textContent = "パネルをタップすると、上下左右もくるりん！";
    elements.chain.textContent = "0";
    createBoard();
    paintBoard();
  }

  function createBoard() {
    elements.board.style.setProperty("--size", state.stage.size);
    elements.board.replaceChildren();

    state.board.forEach((_, index) => {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.dataset.index = String(index);
      tile.setAttribute("role", "gridcell");

      const card = document.createElement("span");
      card.className = "tile-card";

      const front = document.createElement("span");
      front.className = "tile-face tile-front";

      const back = document.createElement("span");
      back.className = "tile-face tile-back";

      card.append(front, back);
      tile.appendChild(card);

      tile._card = card;
      tile._frontFace = front;
      tile._backFace = back;
      tile._flipped = false;

      tile.addEventListener("click", () => handleMove(index));
      elements.board.appendChild(tile);
    });
  }

  function paintFace(face, type) {
    face.dataset.type = type || "empty";
    face.textContent = type ? ICONS[type] : "";
  }

  function paintTile(index) {
    const tile = elements.board.children[index];
    if (!tile) return;

    const type = state.board[index];
    tile.dataset.type = type || "empty";
    tile.disabled = state.busy || state.cleared || !type;
    tile.setAttribute(
      "aria-label",
      type === "grass" ? "草パネル" : type === "berry" ? "木の実パネル" : "空きマス"
    );

    if (!type) {
      paintFace(tile._frontFace, null);
      paintFace(tile._backFace, null);
      return;
    }

    if (tile._flipped) {
      paintFace(tile._backFace, type);
      paintFace(tile._frontFace, FLIP[type]);
      tile._card.style.transform = "rotateY(180deg)";
    } else {
      paintFace(tile._frontFace, type);
      paintFace(tile._backFace, FLIP[type]);
      tile._card.style.transform = "rotateY(0deg)";
    }
  }

  function paintBoard() {
    const { stage, movesUsed, collected } = state;
    elements.stage.textContent = stage.id;
    elements.moves.textContent = `${Math.max(0, stage.maxMoves - movesUsed)}手`;

    const count = collected[stage.goal.tile] || 0;
    elements.goal.textContent = `${ICONS[stage.goal.tile]}を ${stage.goal.count}こ あつめよう（${Math.min(count, stage.goal.count)}/${stage.goal.count}）`;
    elements.goalBar.style.width = `${Math.min(100, count / stage.goal.count * 100)}%`;

    for (let index = 0; index < state.board.length; index += 1) paintTile(index);
  }

  function neighbors(index) {
    const size = state.stage.size;
    const row = Math.floor(index / size);
    const col = index % size;

    return [
      [row, col],
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1]
    ]
      .filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)
      .map(([r, c]) => r * size + c);
  }

  async function flipTile(index, delayMs) {
    if (delayMs) await sleep(delayMs);

    const tile = elements.board.children[index];
    if (!tile || !state.board[index]) return;

    const card = tile._card;
    const oldType = state.board[index];
    const newType = FLIP[oldType];
    const startAngle = tile._flipped ? 180 : 0;
    const endAngle = startAngle + 180;
    const duration = prefersReducedMotion ? TIMING.reducedFlip : TIMING.flip;

    if (tile._flipped) {
      paintFace(tile._backFace, oldType);
      paintFace(tile._frontFace, newType);
    } else {
      paintFace(tile._frontFace, oldType);
      paintFace(tile._backFace, newType);
    }

    tile.classList.add("tap-wave", "flip-active");

    const keyframes = [
      { transform: `translateY(0) rotateY(${startAngle}deg) scale(1)`, filter: "brightness(1)", offset: 0 },
      { transform: `translateY(-5px) rotateY(${startAngle + 72}deg) scale(.975)`, filter: "brightness(1.08)", offset: .40 },
      { transform: `translateY(-5px) rotateY(${startAngle + 90}deg) scale(.96)`, filter: "brightness(1.12)", offset: .50 },
      { transform: `translateY(-2px) rotateY(${startAngle + 158}deg) scale(1.015)`, filter: "brightness(1.04)", offset: .84 },
      { transform: `translateY(0) rotateY(${endAngle}deg) scale(1.035)`, filter: "brightness(1.01)", offset: .94 },
      { transform: `translateY(0) rotateY(${endAngle}deg) scale(1)`, filter: "brightness(1)", offset: 1 }
    ];

    if (typeof card.animate === "function") {
      const animation = card.animate(keyframes, {
        duration,
        easing: "cubic-bezier(.22,.72,.25,1)",
        fill: "forwards"
      });
      try {
        await animation.finished;
      } catch (_) {
        // Interrupted animations simply settle to their target below.
      }

      const normalizedAngle = endAngle % 360;
      card.style.transform = `rotateY(${normalizedAngle}deg)`;
      animation.cancel();
    } else {
      card.style.transition = `transform ${duration}ms cubic-bezier(.22,.72,.25,1)`;
      card.style.transform = `rotateY(${endAngle}deg)`;
      await sleep(duration);
      card.style.transition = "none";
      card.style.transform = `rotateY(${endAngle % 360}deg)`;
      void card.offsetWidth;
      card.style.removeProperty("transition");
    }

    state.board[index] = newType;
    tile._flipped = !tile._flipped;
    paintTile(index);
    tile.classList.remove("tap-wave", "flip-active");
  }

  async function animateFlip(indices, center) {
    const jobs = indices.map(index => {
      const delay = index === center ? 0 : TIMING.neighborDelay;
      return flipTile(index, delay);
    });

    await Promise.all(jobs);
    await sleep(TIMING.settle);
  }

  async function handleMove(index) {
    const { stage } = state;
    if (state.busy || state.cleared || state.movesUsed >= stage.maxMoves) return;

    state.busy = true;
    state.movesUsed += 1;
    elements.chain.textContent = "0";
    paintBoard();

    await animateFlip(neighbors(index), index);

    let chain = 0;
    while (true) {
      const matches = findMatches();
      if (!matches.size) break;

      chain += 1;
      showChain(chain);
      await clearMatches(matches);

      const drops = collapseBoard();
      paintBoard();
      animateDrops(drops, chain);
      await sleep(Math.max(180, TIMING.drop - chain * 18));
      clearMotionClasses();
    }

    if (state.board.some(value => value === null)) {
      const spawns = refillSafely();
      paintBoard();
      animateSpawns(spawns);
      await sleep(TIMING.refill + state.stage.size * 22);
      clearMotionClasses();
    }

    if (isClear()) {
      state.cleared = true;
      elements.message.className = "message success";
      elements.message.textContent = "クリア！ ステゴンもうれしそう。";
      elements.next.disabled = stageIndex >= window.STEGON_STAGES.length - 1;
    } else if (state.movesUsed >= stage.maxMoves) {
      elements.message.textContent = "あとちょっと。やりなおしてみよう！";
    } else if (!chain) {
      elements.message.textContent = "こんどは、3つならぶ場所をさがしてみよう。";
    }

    state.busy = false;
    paintBoard();
  }

  function findMatches(board = state.board) {
    const size = state.stage.size;
    const matches = new Set();

    const scan = indices => {
      let start = 0;
      while (start < indices.length) {
        const type = board[indices[start]];
        let end = start + 1;
        while (type && end < indices.length && board[indices[end]] === type) end += 1;
        if (type && end - start >= 3) {
          for (let i = start; i < end; i += 1) matches.add(indices[i]);
        }
        start = end;
      }
    };

    for (let i = 0; i < size; i += 1) {
      scan(Array.from({ length: size }, (_, c) => i * size + c));
      scan(Array.from({ length: size }, (_, r) => r * size + i));
    }

    return matches;
  }

  async function clearMatches(matches) {
    matches.forEach(index => elements.board.children[index].classList.add("clearing"));
    await sleep(TIMING.clear);

    matches.forEach(index => {
      const type = state.board[index];
      if (type) state.collected[type] += 1;
      state.board[index] = null;
    });

    paintBoard();
    clearMotionClasses();
  }

  function collapseBoard() {
    const size = state.stage.size;
    const drops = new Map();

    for (let col = 0; col < size; col += 1) {
      let targetRow = size - 1;

      for (let row = size - 1; row >= 0; row -= 1) {
        const from = row * size + col;
        if (!state.board[from]) continue;

        const target = targetRow * size + col;
        state.board[target] = state.board[from];
        if (target !== from) {
          state.board[from] = null;
          drops.set(target, targetRow - row);
        }
        targetRow -= 1;
      }

      while (targetRow >= 0) state.board[targetRow-- * size + col] = null;
    }

    return drops;
  }

  function tileStep() {
    const tile = elements.board.querySelector(".tile");
    const styles = getComputedStyle(elements.board);
    return (tile ? tile.getBoundingClientRect().height : 0) + (parseFloat(styles.rowGap || styles.gap) || 0);
  }

  function animateDrops(drops, chain) {
    const step = tileStep();
    drops.forEach((rows, index) => {
      const tile = elements.board.children[index];
      tile.style.setProperty("--drop-y", `${-rows * step}px`);
      tile.style.setProperty("--motion-duration", `${Math.max(180, TIMING.drop - chain * 18)}ms`);
      tile.classList.add("dropping");
    });
  }

  function animateSpawns(indices) {
    const size = state.stage.size;
    const step = tileStep();

    indices.forEach(index => {
      const row = Math.floor(index / size);
      const tile = elements.board.children[index];
      tile.style.setProperty("--spawn-y", `${-(row + 1) * step}px`);
      tile.style.setProperty("--spawn-delay", `${(index % size) * 24 + row * 16}ms`);
      tile.classList.add("spawning");
    });
  }

  function refillSafely() {
    const holes = state.board
      .map((value, index) => value === null ? index : -1)
      .filter(index => index >= 0);

    const preferred = holes.map(
      (_, offset) => state.stage.refill[(state.refillIndex + offset) % state.stage.refill.length]
    );

    const fill = position => {
      if (position === holes.length) return findMatches().size === 0;

      const index = holes[position];
      for (const type of [preferred[position], FLIP[preferred[position]]]) {
        state.board[index] = type;
        if (!findMatches().size && fill(position + 1)) return true;
      }

      state.board[index] = null;
      return false;
    };

    if (!fill(0)) {
      holes.forEach((index, offset) => {
        state.board[index] = preferred[offset];
      });
    }

    state.refillIndex += holes.length;
    return holes;
  }

  function showChain(chain) {
    elements.chain.textContent = String(chain);
    elements.message.textContent = chain === 1 ? "けせた！" : `${chain}れんさ！`;
    elements.callout.textContent = chain === 1 ? "NICE!" : `${chain}れんさ！`;
    elements.callout.dataset.level = String(Math.min(chain, 4));
    elements.callout.classList.remove("show");
    void elements.callout.offsetWidth;
    elements.callout.classList.add("show");

    elements.chain.classList.remove("chain-pop");
    void elements.chain.offsetWidth;
    elements.chain.classList.add("chain-pop");

    if (chain >= 2 && navigator.vibrate) {
      navigator.vibrate(chain >= 4 ? [25, 20, 35] : chain >= 3 ? 35 : 22);
    }
  }

  function clearMotionClasses() {
    elements.board.querySelectorAll(".tile").forEach(tile => {
      tile.classList.remove("clearing", "dropping", "spawning");
      tile.style.removeProperty("--motion-duration");
    });
  }

  function isClear() {
    return state.collected[state.stage.goal.tile] >= state.stage.goal.count;
  }

  elements.restart.addEventListener("click", () => loadStage(stageIndex));
  elements.next.addEventListener("click", () => loadStage(stageIndex + 1));

  loadStage(0);
})();