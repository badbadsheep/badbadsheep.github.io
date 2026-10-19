---
title: 从0开始的C语言生活
date: 2026-10-15
tags:
  - 杂七杂八的小题
draft: false
summary: C需慢慢写，心急则报错。
---

 C需慢慢磨，心急则报错

## Introduction

这里将持续记录从0开始学习c的心得。题目或易或难，大部分来自于程序设计课的作业。做题过程中的神秘错误、知识点、优化过程...统统大杂烩写在这里--->

知识点写在书上期末大概率不会看，写在这里就不一定 ^^

初来乍到，如有错误之处欢迎指正！

## 基本语法
### 2026/10/15 
#### char
Q1 编程实现简易的计算器：读入两个整数运算数(data1和data2)及一个运算符(op)，计算表达式data1 op data2的值，其中op可以是-+等，比如输入a b * 输出a*b的结果

```c
#include <stdio.h>{
int main() 
    int a=0,b=0;//赋值写俩=0
    int x=0;//赋值一个0是为了防止产生垃圾值
    char op;                                         
    scanf("%d %d %c",&a,&b,&op);  
/*char是一种整型（存储的是一个字节的ASCII码，本质是一个小整数，所以叫做整型）
/*给char赋值，比较时，用单引号框住赋值/等待比较的对象 如 char a = 'A' / if ( a == 'B')
/*当然 上面的char op; 这里的op是一个变量名，当然不加‘’
/*这道题难点当时卡在了怎么输入一个运算符号，C语言似乎不存在可以自动把*输入检测成乘法的功能，所以可以人为的引入判断！依次对比char的值跟+*-/来判断选哪个*/    
      if (op=='+'){
        x=a+b;
}else if (op=='*'){
        x=a*b;
}else if (op=='-'){
        x=a-b;
}else if (op=='/'&& b==0){
        printf("0不能做除数"); //别漏分号了我求你了
        return 1; 
//在main函数里 return 1可直接中止进程
}else if (op=='/'){
        x=(flaot)a/b;
}else {
    printf("unknown op\n");
    return 1; 
}
 
    if(x==(int)x){
        printf("%.0f",x);} //把小数点去掉
//该输出整数就输出整数，无法做到才输出2位小数
    else{
        printf("%.2f",x);} 
}


```

奇妙错误：
  （×）  scanf("%d" "%d" "%c",&a,&b,&op); 
多个输入应该直接写成"%d %d %d",...

c语言里，整数除以整数只能得到整数（自动四舍五入了）
所以做除法时，必须把一个数转化成浮点数（float）

下面程序可加深对char的理解

```c
#include <stdio.h>
int main(){

char c1,c2;
c1='A';         //将A的ASCII码值65存入了c1   
c2=c1+300;       //拿着c1的值65又加上了300得到365。
//在c环境里，char整型的大小是八位字节，多出的部分会被截断，只取低位8位（等价于对256取余）
//于是得到了109，即为m的ASCII码
printf("c1=%c, c2=%c\n",c1,c2);     //调用的是%c 输出的是char值          
printf("c1=%d, c2=%d\n",c1,c2);  


//记住char在声明的时候只能存入一个字符！ ‘abc’ ‘100’则报错

//此处可以拓展一下printf的工作原理：

/*实参（这里传入的就是65 109）
  ↓
按 C 规则传参（char 提升为 int）
  ↓
printf 收到参数，但不知道类型
  ↓
格式串 %... 告诉 printf 按什么类型读取
  ↓
按该格式输出
*/   
}
/*输出结果是：
c1=A, c2=m       
c1=65, c2=109
*/

```
#### sizeof
```c

#include <stdio.h>
int main(){

char a = 0;     //这里存入的是0
char b = '0';   //这里存入的是ASCII值48
printf("%d %d\n",a,b);
printf("%c %c\n",a,b);
printf("%zu %zu\n",sizeof a,sizeof b);
printf("%zu",sizeof(int));
//sizeof是一种运算符，用来运算某数据类型占多少个字节(8 bit)
//后加变量可以不加括号，但跟数据类型的时候需要括号，如 sizeof(int)
/*输出：

0 48
 0      这里的aASCII码是0，对应的是不可见的null字符，所以只显示了b
1 1
4



}



```

Q2 请编写一个程序，输入两个整数a、b，计算并输出它们的乘积c=a\*b mod 2^16（请尝试优化计算mod的算法？）

```c
#include <stdio.h>
int main() {
    int a=0,b=0;
    int x=0;
    scanf("%d %d",&a,&b);
    x=(a*b) & 0xFFFF;  //这里的0xFFFF是十六进制，值为65535
    printf("%d",x);
    return 0;


```

