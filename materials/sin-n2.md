

在下面的证明中, 我们全程用到了下面的简单结论：

> **命题：**若$\lbrace a_n\rbrace$是有界数列, $\lbrace b_n\rbrace$是收敛于0的数列, 则
> 
> $$\lim\limits_{n\to\infty}a_nb_n=0.$$

这个命题用$\varepsilon-N$语言很容易证明. 



## $\lbrace \sin n^2\rbrace$发散的证明


我们用反证法来证明$\lbrace \sin n^2\rbrace$是发散数列. 


假设$\left\lbrace\sin(n^2)\right\rbrace$收敛, 记$\lim\limits_{n\to \infty}\sin(n^2)=a$. 
我们把证明分成两部分. 

### Step 1: 先证明$a=0$. 

由$\lim\limits_{n\to \infty}\sin(n^2)=a$可得

$$\lim\limits_{n\to \infty}\sin(n^2)=\lim\limits_{n\to \infty}\sin(n+i)^2\triangleq a\in\mathbb{R}, \qquad i\in\{-2,-1,1,2\}.$$

利用和差化积以及极限的四则运算性质，可得

$$\begin{aligned}
&\lim\limits_{n\to \infty}\cos(n^2+1)\sin(2n)=0, && (1)\\
&\lim\limits_{n\to \infty}\cos(n^2+4)\sin(4n)=0. && (2)
\end{aligned}$$

又

$$\begin{aligned}
\cos(n^2+4)\sin(4n)&=2(\cos(n^2+1)\sin(2n))\cos(2n)\cos{3} \\
&\qquad -2(\sin(n^2+1)\cos(2n))\sin(2n)\sin{3},
\end{aligned}$$

令$n\to \infty$, 则根据$(1)(2)$可知

$$\lim\limits_{n\to \infty}a\sin(2n)=0.$$

若$a\neq 0$, 则
$\lim\limits_{n\to \infty}\sin(2n)=0. $
又

$$\sin{4}=\sin(2n+2)\cos(2n-2)-\cos(2n+2)\sin(2n-2),$$

令$n\to \infty$, 则$\sin{4}=0$, 矛盾，故$a=0$, 即

$$\lim\limits_{n\to \infty}\sin(n^2)=0. $$ 

### Step 2: 导出矛盾.

由$(n+1)^2+(n-1)^2-2n^2=2$知，

$$\begin{aligned}
\sin{2}&=\sin\Big[(n+1)^2+(n-1)^2-2n^2\Big] \\
&=\sin\Big[(n+1)^2+(n-1)^2\Big]\cos(2n^2)-\cos\Big[(n+1)^2+(n-1)^2\Big]\sin(2n^2) \\
&=\Big[\sin(n+1)^2\cos(n-1)^2+\sin(n-1)^2\cos(n+1)^2\Big]\cos(2n^2) \\
&\qquad -2\cos\Big[(n+1)^2+(n-1)^2\Big]\cos(n^2)\sin(n^2) \\
&=A_n\sin(n+1)^2+B_n\sin(n-1)^2+C_n\sin(n^2),
\end{aligned}$$

其中$A_n,\;B_n,\;C_n$有界, 

$$\begin{aligned}
A_n&=\cos(n-1)^2\cos(2n^2), \\
B_n&=\cos(n+1)^2\cos(2n^2), \\
C_n&=-2\cos\Big[(n+1)^2+(n-1)^2\Big]\cos(n^2).
\end{aligned}$$

令$n\to \infty$, 则$\sin{2}=0$, 矛盾. $\square$	


