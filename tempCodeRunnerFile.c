/*由于最终结果要是精准的分数形式，就不能直接做除法，而是通分再加起来
所以问题的关键在于求分母，即最小公倍数！先自己想象一个思路：
    拿最大的数n，依次求它的1倍，2倍...每求一次，就循环拿n除以1 2 3...只要有除不尽的就换下一个n的倍数。全部除尽就取该值
*/
# include <stdio.h>

long long LCM(int n){
    for (long long k=1;k>=1;k++){  //k是几倍的n
        for (long long i=1;i<=n;i++){  //依次拿kn去挨个除以1 2 3 4 5 ...(不要直接写kn了，是k*n！)
            long long q = k*n % i;
            if (q!=0)     //只要余数不为0就中断
                break;
            if (q==0 && i==n){         //能坚持除到第n项就暂停并返回值
                long long result=k*n;
                return result;       
            }    
        if (i == n)
            return result;
        }
    }
}

int main(){
    int n=0;
    scanf("%lld",&n);
    long long b=LCM(n);
    printf("%lld",b);
}