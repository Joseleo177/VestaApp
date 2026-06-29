import { Entity, Column, UpdateDateColumn } from "typeorm";

@Entity({ name: "settings" })
export class Setting {
  @Column({ primary: true })
  key!: string;

  @Column({ type: "text" })
  value!: string;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
