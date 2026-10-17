---
title: 从0开始的C语言生活
date: 2026-10-15
tags:
  - 杂七杂八的小题
draft: false
summary: C需慢慢写，心急则报错。
---

 C需慢慢磨，心急则报错。

## Introduction

这里将持续记录学习c的心得。题目或易或难，大部分来自于程序设计课的作业。做题过程中的神秘错误、知识点、优化过程...统统大杂烩写在这里--->

知识点写在书上期末大概率不会看，写在这里就不一定 ^^

## 基本语法
## 2026/10/15
Q1 编程实现简易的计算器：读入两个整数运算数(data1和data2)及一个运算符(op)，计算表达式data1 op data2的值，其中op可以是-+等，比如输入a b * 输出a*b的结果

```c
#include <stdio.h>{
int main() 
    int a=0,b=0;//赋值写俩=0
    int x=0;//赋值一个0是为了防止产生垃圾值
    char op; //op未定，所以不加‘’
    scanf("%d %d %c",&a,&b,&op);  
/*char是一种整型（存储的是一个字节的ASCII码，本质是一个小整数，所以是整型）声明和参与比较的时候用单引号括起来*/
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
scanf("%d" "%d" "%c",&a,&b,&op); 
多个输入应该直接写成"%d %d %d",...

c语言里，整数除以整数只能得到整数（自动四舍五入了）
所以做除法时，必须把一个数转化成浮点数（float）

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

