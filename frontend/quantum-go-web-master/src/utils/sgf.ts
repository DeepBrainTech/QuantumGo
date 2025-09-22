// Build SGF for Quantum Go as a collection of two games (board1 and board2)
// records: array of { add: [{ position: 'x,y', brother: 'x,y', type: 'black'|'white' }], reduce: [...] }
// model: 7|9|13|19
// komi: number
export function exportQuantumSGF(records: any[], model: number, komi: number): string {
  const toSgfCoord = (pos: string): string => {
    if (!pos || pos === '0,0') return '';
    const [xs, ys] = pos.split(',');
    const x = Math.max(1, parseInt(xs, 10));
    const y = Math.max(1, parseInt(ys, 10));
    const a = (n: number) => String.fromCharCode('a'.charCodeAt(0) + (n - 1));
    return a(x) + a(y); // SGF: first is column (y), second is row (x) given our x=col, y=row convention
  };

  const header = (title: string) => `(;FF[4]GM[1]SZ[${model}]KM[${komi}]PB[Black]PW[White]C[${title}])`;

  const buildGame = (boardIdx: 1 | 2): string => {
    let sgf = `(;FF[4]GM[1]SZ[${model}]KM[${komi}]PB[Black]PW[White]C[Quantum Go ${boardIdx}]`;
    for (let i = 0; i < records.length; i++) {
      const add = records[i]?.add?.[0];
      if (!add) continue;
      const color = (() => {
        if (boardIdx === 1) return add.type;
        // board2: first two moves inverted in this variant
        if (i <= 1) return add.type === 'black' ? 'white' : 'black';
        return add.type;
      })();
      const pos = boardIdx === 1 
      ? add.position
      : (i<=1 ? add.position : add.brother);
      const sgfMove = `${color === 'black' ? 'B' : 'W'}[${toSgfCoord(pos)}]`;
      sgf += `;${sgfMove}`;
    }
    sgf += ')';
    return sgf;
  };

  // SGF collection: two separate game trees
  const g1 = buildGame(1);
  const g2 = buildGame(2);
  return `${g1}${g2}`;
}

