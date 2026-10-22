/*想要打印杨辉三角，需要面对一下问题：
1 每一项怎么对齐，空格数要对。
2 每一项怎么算。c没有组合数也没有阶乘，只能自己用循环写.可以写一个函数来简化
*/

//Cmn函数：想要实现Cmn，先需要阶乘。需要让一个数从1开始依次乘到自己。先捋清楚求x的阶乘的代码：
//  for (i=1;i<=x;i++){
//        the_result_of_x*=i
// 这时再来解决Cmn
long long Cmn(int m,int n){
    long long fac_m=1;
    long long fac_n=1;
    long long fac_minus=1;   //注意！变量名不能叫做(m-n)!    -是违法符号！
    for (int i=1;i<=m;i++){
        fac_m *=i;
    }
    for (int j=1;j<=n;j++){
        fac_n *=j;
    }
    for (int e=1;e<=(m-n);e++){
        fac_minus *=e;
    }
    long long result = fac_m/((fac_n)*(fac_minus)); //这里分母要带括号！ 因为/*平等
    return result;
}

#include <stdio.h>
int main(){
    int m=0,n=0,x=0,y=0; //m是当前行数，n是用户输入的总行数，x是某一行的项的数量，y是空格数。
    scanf("%d",&n);
    for (m=0;m<=n;m++){
        
        for (y=0;y<=(n-m-1);y++){  //让y的上限卡在两倍的n-m处，从而实现打出来1前面的空格。
            printf("  ");          //这里y<=n-m+1 ?
        }
        
        /*现在要算出项数，先打个草稿：
        组合数Cmn= m!/(n!)*(m-n)！ 嵌套各种循环有点繁琐，考虑定义一个函数*/
        
        for (int t=0;t<=m;t++){
            printf("   %lld",Cmn(m,t));  //这里输入应该是m和t，而不是m+1,t+1
        }                                //
        printf("\n");
    }
}

// ------***1                  m=0 n=3  要打印6个空格
// ----***1***1
// --***1***2***1
// ***1***3***3***1   