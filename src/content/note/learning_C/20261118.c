# include <stdio.h>
int main(){
    int L=0, R=0;
    scanf("%d %d",&L,&R);
    int x=L, i=L, num=0; 
    
    for (i=L; i<=R; i++){
        
        int x = i;

    while (x > 0){
        if ( x%10 == 2 ){
            num++;
        }
        x = (x - x%10) / 10; //一直进行下去时x会归为0，故while循环条件为x>0，if也没必要加 || x == 2
    }
}
    printf("%d",num);

}