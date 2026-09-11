// Six paired arms form a volumetric plus. Seven such pluses form each cell.
export function plusParts() {
    const parts=[];
    for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) for(const segment of [0,1]) {
        const p=[0,0,0], scale=[.45,.45,.45];
        p[axis]=sign*(.5+segment); scale[axis]=1;
        parts.push({p,scale,axis});
    }
    return parts;
}

export const MODULES=[[0,0,0],[2.05,0,0],[-2.05,0,0],[0,2.05,0],[0,-2.05,0],[0,0,2.05],[0,0,-2.05]];
