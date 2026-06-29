import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { Property } from "./Property";

@Entity({ name: "towers" })
export class Tower {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @OneToMany(() => Property, (p) => p.tower)
  properties!: Property[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
