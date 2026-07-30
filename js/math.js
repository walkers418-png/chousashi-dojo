// 数式の表示 — 簡潔な記法から MathML を生成する。
//
// 数式を生の MathML で書くと1つの分数が5行になり、データファイルが読めなくなる。
// そこで LaTeX に似た最小限の記法だけを解釈する小さな変換器を置く。
// 外部ライブラリは使わない（オフラインPWA・CSPのため）。MathML はブラウザ標準機能。
//
// 使える記法:
//   \frac{分子}{分母}      分数
//   \sqrt{中身}            平方根
//   \sqrt[4]{中身}         4乗根など
//   \abs{中身}             絶対値 |中身|
//   \paren{中身}           括弧（高さが中身に合う）
//   a^{2}  a_{i}           上付き・下付き
//   \angle                 ∠（方向角の記法 S∠T で使う）
//   それ以外の文字         そのまま記号・変数・日本語として表示
//
// 例: mathml("\\frac{n·A ＋ m·B}{m ＋ n}")
//     mathml("PT ＝ \\sqrt{\\abs{OP}^{2} − r^{2}}")

(function (global) {
  // 演算子として扱う文字。前後に余白が入る。
  const OPS = "＝=＋+−-±×÷·⋅∠≦≧<>≒,，、（）()[]";
  // 数字（半角・全角）と小数点
  const NUM = /[0-9０-９.．]/;

  function isOp(ch) {
    return OPS.indexOf(ch) >= 0;
  }

  // 入力文字列を先頭から読み進めるための小さなカーソル
  function reader(src) {
    let i = 0;
    return {
      eof: () => i >= src.length,
      peek: () => src[i],
      next: () => src[i++],
      // { … } を対応を取って読む（入れ子に対応）
      group() {
        if (src[i] !== "{") return "";
        let depth = 0,
          start = ++i;
        while (i < src.length) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") {
            if (depth === 0) return src.slice(start, i++);
            depth--;
          }
          i++;
        }
        return src.slice(start);
      },
      // [ … ] を読む（\sqrt[4]{} の指数用）
      bracket() {
        if (src[i] !== "[") return "";
        const start = ++i;
        while (i < src.length && src[i] !== "]") i++;
        return src.slice(start, i++);
      },
      // \コマンド名 を読む
      command() {
        let s = "";
        while (i < src.length && /[a-zA-Z]/.test(src[i])) s += src[i++];
        return s;
      },
    };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // 直前の要素（上付き・下付きはこれに掛かる）を差し替えられるよう配列で持つ
  function parse(src) {
    const r = reader(src);
    const out = [];
    let buf = "",
      bufKind = null; // "num" | "id"

    const flush = () => {
      if (!buf) return;
      out.push(
        bufKind === "num"
          ? `<mn>${esc(buf)}</mn>`
          : `<mi mathvariant="normal">${esc(buf)}</mi>`,
      );
      buf = "";
      bufKind = null;
    };

    while (!r.eof()) {
      const ch = r.next();

      if (ch === "\\") {
        flush();
        const cmd = r.command();
        if (cmd === "frac") {
          const n = parse(r.group()),
            d = parse(r.group());
          out.push(`<mfrac><mrow>${n}</mrow><mrow>${d}</mrow></mfrac>`);
        } else if (cmd === "sqrt") {
          const idx = r.bracket();
          const body = parse(r.group());
          out.push(
            idx
              ? `<mroot><mrow>${body}</mrow><mn>${esc(idx)}</mn></mroot>`
              : `<msqrt><mrow>${body}</mrow></msqrt>`,
          );
        } else if (cmd === "abs") {
          out.push(
            `<mrow><mo stretchy="true">|</mo>${parse(r.group())}<mo stretchy="true">|</mo></mrow>`,
          );
        } else if (cmd === "paren") {
          out.push(
            `<mrow><mo stretchy="true">(</mo>${parse(r.group())}<mo stretchy="true">)</mo></mrow>`,
          );
        } else if (cmd === "angle") {
          out.push(`<mo>∠</mo>`);
        } else {
          // 未知のコマンドは記号としてそのまま出す（壊さないため）
          out.push(`<mo>${esc(cmd)}</mo>`);
        }
        continue;
      }

      if (ch === "^" || ch === "_") {
        flush();
        const tag = ch === "^" ? "msup" : "msub";
        const body = parse(r.peek() === "{" ? r.group() : r.next());
        const base = out.pop() || "<mi></mi>";
        out.push(`<${tag}>${base}<mrow>${body}</mrow></${tag}>`);
        continue;
      }

      if (isOp(ch)) {
        flush();
        out.push(`<mo>${esc(ch)}</mo>`);
        continue;
      }

      // 半角スペースは区切りとして捨てるが、全角スペースは「意図した間隔」として
      // 空白を残す。1つの数式に2本の式を並べるとき（a＝… 　　h＝…）に必要。
      if (ch === " ") {
        flush();
        continue;
      }
      if (ch === "　") {
        flush();
        out.push(`<mspace width="1.2em"></mspace>`);
        continue;
      }

      // 数字と文字はまとめてから出す（"12.5" を1つの数として扱うため）
      const kind = NUM.test(ch) ? "num" : "id";
      if (bufKind && bufKind !== kind) flush();
      bufKind = kind;
      buf += ch;
    }
    flush();
    return out.join("");
  }

  // 数式1つを <math> で包んで返す。block=true で独立行（中央寄せ・大きめ）。
  //
  // <math> 自体には CSS の display を当ててはいけない。display:block などを指定すると
  // MathML のレイアウトが解除され、分数や記号が1文字ずつ縦に折り返して崩れる。
  // 独立行にしたいときは外側の div で位置と横スクロールを制御する。
  function mathml(src, block) {
    const m =
      `<math xmlns="http://www.w3.org/1998/Math/MathML"` +
      `${block ? ' display="block"' : ""} class="mx">${parse(String(src))}</math>`;
    return block ? `<div class="math-block">${m}</div>` : m;
  }

  // 文字列中の $…$ を数式に変換する。地の文と数式が混じる解説文で使う。
  function mathInline(text) {
    return String(text).replace(/\$([^$]+)\$/g, (_, m) => mathml(m, false));
  }

  global.mathml = mathml;
  global.mathInline = mathInline;
})(this);
