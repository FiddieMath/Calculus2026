
> 本文是老师在群里发的PDF文件. 


一个实数如果是某个整系数多项式的根, 则我们称该实数为 “代数数”, 否则称为 “超越数”.
显然所有的有理数都是代数数, 有些无理数如$\sqrt{2}$也是代数数.
但是所有代数数构成的集合是可数集 (按照多项式的次数分
类，注意每个$n$次多项式最多有$n$个实根).
于是几乎所有的实数都是超越数.

然而要判断一个具体的实数是否是超越数往往是很不容易的. 
1873年法国数学家Charles Hermite证明了$e$是超越数,
随后德国数学家Ferdinand von Lindemann在此基础上证明了$\pi$也是超越数, 但是证明更加复杂. 
1893年David Hilbert在论文[1]中给出了$e$和$\pi$超越性的简化证明.
我们下面的证明本质属于Hilbert, 也可参考[2].

证明的出发点是如下简单的分部积分公式: 设$f$是$n$次多项式, 则$f(n+1)\equiv 0$, 于是

$$\begin{aligned}
\int_0^bf(x)e^{-x}\mathrm{d}x&=-e^{-x}f(x)\Big\vert_0^b+\int_0^bf'(x)e^{-x}\mathrm{d}x \\
&=-e^{-x}[f(x)+f'(x)]\Big\vert_0^b+\int_0^bf''(x)e^{-x}\mathrm{d}x \\
&=\cdots=-e^{-x}[f(x)+f'(x)+\cdots+f^{(n)}(x)]\Big\vert_0^b.
\end{aligned}$$

记$Q(x):=f(x)+f'(x)+\cdots+f^{(n)}(x)$, 则可将上式写为

$$e^bQ(0)=Q(b)+e^b\int_0^bf(x)e^{-x}\mathrm{d}x. \tag{1}$$

假设$e$是代数数, 则存在整数$c_0,\cdots,c_m$满足

$$c_0+c_1e+\cdots+c_me^m=0,$$

$c_0\ne 0$. 在$(1)$中令$b=0,1,\cdots,m$可得

$$0=\sum\limits_{i=0}^mc_ie^iQ(0)=\sum\limits_{i=0}^mc_iQ(i)+\sum\limits_{i=0}^mc_ie^i
\int_0^if(x)e^{-x}\mathrm{d}x. \tag{2}$$

注意$(2)$对任何多项式$f$都成立. 

下面我们将构造特殊的$f$使得$(2)$不可能成立，这就说明$e$一定是超越数. 

设$p$是一个大于$m$和$\mid c_0\mid $的素数, 令

$$f(x):=\dfrac{1}{(p-1)!}x^{p-1}(x-1)^p(x-2)^p\cdots(x-m)^p,$$

以及$Q(x)=f(x)+f'(x)+\cdots+f^{(mp+p-1)}(x)$. 我们要说明$f$满足如下三条性质: 

**1.** 对$i=1,\cdots,m$, $Q(i)$都是整数, 且$p\mid Q(i)$;

**2.** $Q(0)$也是整数, 但$p\nmid Q(0)$;

**3.** 当$p\to\infty$时, 有

$$\sum\limits_{i=0}^mc_ie^i\int_0^if(x)e^{-x}\mathrm{d}x\to 0.$$

先承认这三条性质. 由于$p > \vert c_0\vert$, 故$p\nmid\vert c_0\vert $. 结合性质1、2可知$\sum\limits_{i=0}^mc_iQ(i)$一定是整数,
但不能被$p$整除. 于是$\left\vert\sum\limits_{i=0}^mc_iQ(i)\right\vert\ge 1$. 
但现在由性质3可知：当$p$足够大时$\sum\limits_{i=0}^mc_iQ(i)+\sum\limits_{i=0}^mc_ie^i\int_0^if(x)e^{-x}\mathrm{d}x$
不可能是$0$, 于是得到矛盾. 

## 性质1的证明

首先我们来说明当$k\ge p$时，$f(k)$的系数都是整数并且可被$p$整除. 注意我们有

$$f(x)=\dfrac{((-1)^mm!)^px^{p-1}+B_px^p+\cdots+x^{mp+p-1}}{(p-1)!},$$

且分子的各项系数都是整数. 求$k$次导数之后，分子上每项的系数如果非$0$一定是$k$个连续正整数的乘积的整数倍. 
显然$p$个连续正整数的乘积能被$p!$整除:

$$\dfrac{(n+1)(n+2)\cdots(n+p)}{p!}=\dfrac{(n+p)!}{n!p!}=C_{n+p}^p\in\mathbb{N}.$$

于是$f^{(k)}$的系数都是整数, 并且能被$p$整除. 于是对$i=0,1,\cdots,m$和$k=p,p+1,\cdots,mp+p-1$,
有$f^{(k)}(i)\in\mathbb{Z}$以及$p\mid f^{(k)}(i)$. 

另一方面, 当$i=1,\cdots,m$且$k\le p-1$时, 显然有$f^{(k)}(i)=0$. 于是$Q(i)\in\mathbb{Z}$并且$p\mid Q(i)$, 
$i=1,\cdots,m$. 

## 性质2的证明

由性质1的证明, 我们只需计算$f^{(k)}(0)$, 其中$k\le p-1$.

如果$k < p-1$, 显然有$f^{(k)}(0)=0$. 又$f^{(p-1)}(0)=((-1)^mm!)^p$. 
由于$p>m$是素数, 故$p\nmid m!$, 进而$p\nmid Q(0)$. 

## 性质3的证明

在$[0,m]$上我们有不等式

$$|f(x)|\le\dfrac{m^{(p-1)+mp}}{(p-1)!}.$$

于是

$$\left|\int_0^if(x)e^{-x}\mathrm{d}x\right|\le\dfrac{m^{(p-1)+mp}}{(p-1)!}\int_0^ie^{-x}\mathrm{d}x 
< \dfrac{m^{p-1+mp}}{(p-1)!}.$$

所以

$$\left|\sum\limits_{i=0}^mc_ie^i\int_0^if(x)e^{-x}\mathrm{d}x\right|
\le Ce^m\dfrac{m^{p-1+mp}}{(p-1)!}
= Ce^mm^m\dfrac{(m^{m+1})^{p-1}}{(p-1)!}\to 0\quad (p\to\infty).$$


[1] Hilbert, David, Über die Transcendenz der Zahlen $e$ und $\pi$, Math. Ann.,43(1893), 216-219.

[2] 菲赫金哥尔茨，微积分学教程，高等教育出版社.
