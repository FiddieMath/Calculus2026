
我们前⾯做过这样⼀个问题：假设$0 < a < b$, 定义⼀个递推数列：$a_1=a$, $b_1=b$, $a_{n+1}=\sqrt{a_nb_n}$, 
$b_{n+1}=\dfrac{a_n+b_n}{2}$, 则$a_n$和$b_n$收敛于相同的极限$c > 0$. 
问题是：$c$具体等于多少？德国数学家 C. F. Gauss 通过积分的换元法发现了如下的做法：

考虑积分

$$G:=\int_0^{\frac{\pi}{2}}\dfrac{\mathrm{d}\varphi}{\sqrt{b^2\cos^2\varphi+a^2\sin^2\varphi}}.$$

Gauss做了如下的变量替换：

$$\sin\varphi=\dfrac{2b\sin\theta}{(a+b)+(b-a)\sin^2\theta}, \tag{1}$$

即

$$\varphi=\arcsin\left(\dfrac{2b\sin\theta}{(a+b)+(b-a)\sin^2\theta}\right).$$

容易看出函数$\dfrac{2bt}{(a+b)+(b-a)t^2}$是$t$的严格增函数, 
所以$\varphi$从$0$增加到$\dfrac{\pi}{2}$恰好对应$\theta$从$0$增加到$\dfrac{\pi}{2}$. 
为了计算换元之后的表达式，一个简单一点的方法是对$(1)$求微分，得到

$$\cos\varphi\mathrm{d}\varphi=2b\dfrac{a+b-(b-a)\sin^2\theta}{[(a+b)+(b-a)\sin^2\theta]^2}\cos\theta\mathrm{d}\theta,$$

再计算$\cos\varphi$, 带入可得

$$\mathrm{d}\varphi = 2b\dfrac{(a+b)-(b-a)\sin^2\theta}{(a+b)+(b-a)\sin^2\theta}
\dfrac{\mathrm{d}\theta}{\sqrt{(a+b)^2-(b-a)^2\sin^2\theta}}.$$

进而得到

$$G=\int_0^{\frac{\pi}{2}}\dfrac{2\mathrm{d}\theta}{\sqrt{(a+b)^2\cos^2\theta+4ab\sin^2\theta}}
=\int_0^{\frac{\pi}{2}}\dfrac{\mathrm{d}\theta}{\sqrt{b_2^2\cos^2\theta+a_2^2\sin^2\theta}}.$$

如此归纳地进⾏下去，得到

$$G=\int_0^{\frac{\pi}{2}}\dfrac{\mathrm{d}\theta}{\sqrt{b_n^2\cos^2\theta+a_n^2\sin^2\theta}}, \forall n\in\mathbb{N}.$$

由于$a_n\le b_n$, 所以有

$$\dfrac{\pi}{2b_n}\le \int_0^{\frac{\pi}{2}}\dfrac{\mathrm{d}\theta}{\sqrt{b_n^2\cos^2\theta+a_n^2\sin^2\theta}} \le\dfrac{\pi}{2a_n}.$$

即

$$\dfrac{\pi}{2b_n}\le G \le\dfrac{\pi}{2a_n}.$$

取极限并利用夹逼准则, 可得

$$G=\lim\limits_{n\to\infty}\int_0^{\frac{\pi}{2}}\dfrac{\mathrm{d}\theta}{\sqrt{b_n^2\cos^2\theta+a_n^2\sin^2\theta}}
=\dfrac{\pi}{2c},$$

即

$$c=\dfrac{\pi}{2}\left(\int_0^{\frac{\pi}{2}}\frac{\mathrm{d}\varphi}{\sqrt{b^2\cos^2\varphi+a^2\sin^2\varphi}}\right)^{-1}.$$


[1] 菲赫金哥尔茨，微积分学教程，高等教育出版社.
